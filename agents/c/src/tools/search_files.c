/*
 * Tool: search_files — regex search across filesystem using POSIX APIs.
 */
#include "tools.h"
#include "../utils.h"
#include "vendor/cJSON.h"
#include <dirent.h>
#include <sys/stat.h>
#include <regex.h>
#include <fnmatch.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>

static const char *SKIP_DIRS[] = {"node_modules", ".git", "__pycache__", NULL};

static int should_skip(const char *name) {
    for (int i = 0; SKIP_DIRS[i]; i++)
        if (strcmp(name, SKIP_DIRS[i]) == 0) return 1;
    return 0;
}

static void search_dir(const char *dir_path, const char *project_path,
                        regex_t *re, const char *include_pat,
                        int *count, int max_results, StrBuf *out) {
    if (*count >= max_results) return;

    DIR *dp = opendir(dir_path);
    if (!dp) return;

    struct dirent *entry;
    while ((entry = readdir(dp)) != NULL && *count < max_results) {
        if (entry->d_name[0] == '.') continue;

        char full[4096];
        snprintf(full, sizeof(full), "%s/%s", dir_path, entry->d_name);

        struct stat st;
        if (stat(full, &st) != 0) continue;

        if (S_ISDIR(st.st_mode)) {
            if (!should_skip(entry->d_name))
                search_dir(full, project_path, re, include_pat, count, max_results, out);
        } else if (S_ISREG(st.st_mode)) {
            if (include_pat && fnmatch(include_pat, entry->d_name, 0) != 0) continue;

            FILE *f = fopen(full, "r");
            if (!f) continue;

            char line[65536];
            int  line_num = 0;
            while (fgets(line, sizeof(line), f) != NULL && *count < max_results) {
                line_num++;
                regmatch_t m;
                if (regexec(re, line, 1, &m, 0) == 0) {
                    /* Strip trailing newline */
                    size_t len = strlen(line);
                    if (len > 0 && line[len - 1] == '\n') line[len - 1] = '\0';

                    /* Relative path */
                    const char *rel = full + strlen(project_path);
                    while (*rel == '/') rel++;

                    strbuf_appendf(out, "%s:%d: %s\n", rel, line_num, line);
                    (*count)++;
                }
            }
            fclose(f);
        }
    }
    closedir(dp);
}

char *tool_search_files(const char *args_json, const char *project_path) {
    cJSON *args = cJSON_Parse(args_json);
    if (!args) return strdup("Error: Failed to parse arguments");

    cJSON *pattern_obj = cJSON_GetObjectItem(args, "pattern");
    cJSON *path_obj    = cJSON_GetObjectItem(args, "path");
    cJSON *include_obj = cJSON_GetObjectItem(args, "include");
    cJSON *max_obj     = cJSON_GetObjectItem(args, "maxResults");

    const char *pattern      = (pattern_obj && cJSON_IsString(pattern_obj)) ? pattern_obj->valuestring : NULL;
    const char *search_path  = (path_obj    && cJSON_IsString(path_obj))    ? path_obj->valuestring    : ".";
    const char *include_pat  = (include_obj && cJSON_IsString(include_obj)) ? include_obj->valuestring : NULL;
    int         max_results  = (max_obj     && cJSON_IsNumber(max_obj))     ? (int)max_obj->valuedouble : 100;

    if (!pattern) {
        cJSON_Delete(args);
        return strdup("Error: pattern is required");
    }

    regex_t re;
    if (regcomp(&re, pattern, REG_EXTENDED) != 0) {
        cJSON_Delete(args);
        char buf[512];
        snprintf(buf, sizeof(buf), "Error: Invalid regex pattern: %s", pattern);
        return strdup(buf);
    }

    char full_path[4096];
    if (search_path[0] == '/') {
        strncpy(full_path, search_path, sizeof(full_path) - 1);
    } else if (strcmp(search_path, ".") == 0) {
        strncpy(full_path, project_path, sizeof(full_path) - 1);
    } else {
        snprintf(full_path, sizeof(full_path), "%s/%s", project_path, search_path);
    }

    StrBuf out;
    strbuf_init(&out, 65536);
    int count = 0;
    search_dir(full_path, project_path, &re, include_pat, &count, max_results, &out);

    regfree(&re);
    cJSON_Delete(args);

    if (count == 0) {
        strbuf_free(&out);
        char buf[512];
        snprintf(buf, sizeof(buf), "No matches found for pattern \"%s\" in %s",
                 pattern, search_path);
        return strdup(buf);
    }

    /* Strip trailing newline */
    if (out.len > 0 && out.data[out.len - 1] == '\n')
        out.data[--out.len] = '\0';

    return out.data;
}
