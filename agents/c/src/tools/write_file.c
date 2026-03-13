/*
 * Tool: write_file — write content to a file, creating parent dirs if needed.
 */
#include "tools.h"
#include "vendor/cJSON.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <errno.h>

/* Recursive mkdir -p */
static int mkdirp(const char *path) {
    char tmp[4096];
    strncpy(tmp, path, sizeof(tmp) - 1);
    tmp[sizeof(tmp) - 1] = '\0';
    size_t len = strlen(tmp);
    if (len > 0 && tmp[len - 1] == '/') tmp[--len] = '\0';

    for (size_t i = 1; i < len; i++) {
        if (tmp[i] == '/') {
            tmp[i] = '\0';
            if (mkdir(tmp, 0755) != 0 && errno != EEXIST) return -1;
            tmp[i] = '/';
        }
    }
    if (mkdir(tmp, 0755) != 0 && errno != EEXIST) return -1;
    return 0;
}

char *tool_write_file(const char *args_json, const char *project_path) {
    cJSON *args = cJSON_Parse(args_json);
    if (!args) return strdup("Error: Failed to parse arguments");

    cJSON *path_obj    = cJSON_GetObjectItem(args, "path");
    cJSON *content_obj = cJSON_GetObjectItem(args, "content");

    if (!path_obj || !cJSON_IsString(path_obj)) {
        cJSON_Delete(args);
        return strdup("Error: path is required");
    }
    if (!content_obj || !cJSON_IsString(content_obj)) {
        cJSON_Delete(args);
        return strdup("Error: content is required");
    }

    const char *file_path = path_obj->valuestring;
    const char *content   = content_obj->valuestring;

    char full_path[4096];
    if (file_path[0] == '/') {
        strncpy(full_path, file_path, sizeof(full_path) - 1);
    } else {
        snprintf(full_path, sizeof(full_path), "%s/%s", project_path, file_path);
    }

    /* Create parent directories */
    char dir[4096];
    strncpy(dir, full_path, sizeof(dir) - 1);
    char *last_slash = strrchr(dir, '/');
    if (last_slash) {
        *last_slash = '\0';
        mkdirp(dir);
    }

    FILE *f = fopen(full_path, "w");
    if (!f) {
        cJSON_Delete(args);
        char buf[512];
        snprintf(buf, sizeof(buf), "Error: Cannot create file: %s", file_path);
        return strdup(buf);
    }

    size_t content_len = strlen(content);
    fwrite(content, 1, content_len, f);
    fclose(f);
    cJSON_Delete(args);

    char result[256];
    snprintf(result, sizeof(result), "Written %zu bytes to %s", content_len, file_path);
    return strdup(result);
}
