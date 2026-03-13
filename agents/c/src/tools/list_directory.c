/*
 * Tool: list_directory — list directory contents with type and size.
 */
#include "tools.h"
#include "../utils.h"
#include "vendor/cJSON.h"
#include <dirent.h>
#include <sys/stat.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>

static char *format_size(long bytes) {
    static char buf[64];
    if (bytes < 1024)
        snprintf(buf, sizeof(buf), "%ldB", bytes);
    else if (bytes < 1024 * 1024)
        snprintf(buf, sizeof(buf), "%.1fKB", bytes / 1024.0);
    else
        snprintf(buf, sizeof(buf), "%.1fMB", bytes / (1024.0 * 1024.0));
    return buf;
}

/* Simple string compare helper for qsort */
static int str_cmp(const void *a, const void *b) {
    return strcmp(*(const char **)a, *(const char **)b);
}

static void list_dir(const char *dir_path, StrBuf *out,
                     int recursive, int max_depth, int depth) {
    DIR *dp = opendir(dir_path);
    if (!dp) return;

    /* Collect names */
    char **names = NULL;
    int n = 0, cap = 64;
    names = (char **)malloc(cap * sizeof(char *));

    struct dirent *entry;
    while ((entry = readdir(dp)) != NULL) {
        if (entry->d_name[0] == '.') continue;
        if (n >= cap) { cap *= 2; names = (char **)realloc(names, cap * sizeof(char *)); }
        names[n++] = strdup(entry->d_name);
    }
    closedir(dp);

    qsort(names, (size_t)n, sizeof(char *), str_cmp);

    char indent[256];
    indent[0] = '\0';
    for (int i = 0; i < depth && i < 64; i++)
        strncat(indent, "  ", sizeof(indent) - strlen(indent) - 1);

    for (int i = 0; i < n; i++) {
        char full[4096];
        snprintf(full, sizeof(full), "%s/%s", dir_path, names[i]);

        struct stat st;
        if (stat(full, &st) != 0) { free(names[i]); continue; }

        if (S_ISDIR(st.st_mode)) {
            /* Count children */
            int child_count = 0;
            DIR *dp2 = opendir(full);
            if (dp2) {
                struct dirent *e2;
                while ((e2 = readdir(dp2)) != NULL)
                    if (e2->d_name[0] != '.') child_count++;
                closedir(dp2);
            }
            strbuf_appendf(out, "%s[DIR]  %s/ (%d items)\n",
                           indent, names[i], child_count);

            if (recursive && depth < max_depth)
                list_dir(full, out, recursive, max_depth, depth + 1);
        } else if (S_ISREG(st.st_mode)) {
            strbuf_appendf(out, "%s[FILE] %s (%s)\n",
                           indent, names[i], format_size(st.st_size));
        }
        free(names[i]);
    }
    free(names);
}

char *tool_list_directory(const char *args_json, const char *project_path) {
    cJSON *args = cJSON_Parse(args_json);
    if (!args) return strdup("Error: Failed to parse arguments");

    cJSON *path_obj      = cJSON_GetObjectItem(args, "path");
    cJSON *recursive_obj = cJSON_GetObjectItem(args, "recursive");
    cJSON *max_depth_obj = cJSON_GetObjectItem(args, "maxDepth");

    const char *dir_path   = (path_obj      && cJSON_IsString(path_obj))   ? path_obj->valuestring : ".";
    int         recursive  = (recursive_obj && cJSON_IsTrue(recursive_obj)) ? 1 : 0;
    int         max_depth  = (max_depth_obj && cJSON_IsNumber(max_depth_obj)) ? (int)max_depth_obj->valuedouble : 3;
    cJSON_Delete(args);

    char full_path[4096];
    if (dir_path[0] == '/') {
        strncpy(full_path, dir_path, sizeof(full_path) - 1);
    } else if (strcmp(dir_path, ".") == 0) {
        strncpy(full_path, project_path, sizeof(full_path) - 1);
    } else {
        snprintf(full_path, sizeof(full_path), "%s/%s", project_path, dir_path);
    }

    struct stat st;
    if (stat(full_path, &st) != 0) {
        char buf[512];
        snprintf(buf, sizeof(buf), "Error: Directory not found: %s", dir_path);
        return strdup(buf);
    }
    if (!S_ISDIR(st.st_mode)) {
        char buf[512];
        snprintf(buf, sizeof(buf), "Error: %s is not a directory", dir_path);
        return strdup(buf);
    }

    StrBuf out;
    strbuf_init(&out, 16384);
    list_dir(full_path, &out, recursive, max_depth, 0);

    if (out.len == 0) {
        strbuf_free(&out);
        char buf[256];
        snprintf(buf, sizeof(buf), "Directory %s is empty", dir_path);
        return strdup(buf);
    }

    if (out.data[out.len - 1] == '\n')
        out.data[--out.len] = '\0';

    return out.data;
}
