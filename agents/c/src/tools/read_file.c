/*
 * Tool: read_file — read file contents with optional line range.
 */
#include "tools.h"
#include "../utils.h"
#include "vendor/cJSON.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

char *tool_read_file(const char *args_json, const char *project_path) {
    cJSON *args = cJSON_Parse(args_json);
    if (!args) return strdup("Error: Failed to parse arguments");

    cJSON *path_obj  = cJSON_GetObjectItem(args, "path");
    cJSON *start_obj = cJSON_GetObjectItem(args, "startLine");
    cJSON *end_obj   = cJSON_GetObjectItem(args, "endLine");

    if (!path_obj || !cJSON_IsString(path_obj)) {
        cJSON_Delete(args);
        return strdup("Error: path is required");
    }

    const char *file_path  = path_obj->valuestring;
    int         start_line = (start_obj && cJSON_IsNumber(start_obj)) ? (int)start_obj->valuedouble : 0;
    int         end_line   = (end_obj   && cJSON_IsNumber(end_obj))   ? (int)end_obj->valuedouble   : 0;
    cJSON_Delete(args);

    char full_path[4096];
    if (file_path[0] == '/') {
        strncpy(full_path, file_path, sizeof(full_path) - 1);
    } else {
        snprintf(full_path, sizeof(full_path), "%s/%s", project_path, file_path);
    }

    struct stat st;
    if (stat(full_path, &st) != 0) {
        char buf[512];
        snprintf(buf, sizeof(buf), "Error: File not found: %s", file_path);
        return strdup(buf);
    }
    if (S_ISDIR(st.st_mode)) {
        char buf[512];
        snprintf(buf, sizeof(buf), "Error: %s is a directory, not a file", file_path);
        return strdup(buf);
    }

    FILE *f = fopen(full_path, "r");
    if (!f) {
        char buf[512];
        snprintf(buf, sizeof(buf), "Error: Cannot open file: %s", file_path);
        return strdup(buf);
    }

    StrBuf out;
    strbuf_init(&out, 65536);

    char line[65536];
    int  line_num = 0;
    while (fgets(line, sizeof(line), f) != NULL) {
        line_num++;

        if (start_line > 0 && line_num < start_line) continue;
        if (end_line   > 0 && line_num > end_line)   break;

        /* Strip trailing newline */
        size_t len = strlen(line);
        if (len > 0 && line[len - 1] == '\n') line[len - 1] = '\0';

        strbuf_appendf(&out, "%d: %s\n", line_num, line);
    }
    fclose(f);

    if (out.len > 0 && out.data[out.len - 1] == '\n')
        out.data[--out.len] = '\0';

    if (out.len == 0) {
        strbuf_free(&out);
        return strdup("(empty file)");
    }

    return out.data;
}
