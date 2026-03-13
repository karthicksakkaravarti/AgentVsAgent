/*
 * Block 1: System Prompt & Persona
 */
#include "prompt.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

char *load_system_prompt(const char *project_path, const char *spec_dir) {
    char path[4096];
    snprintf(path, sizeof(path), "%s/system-prompt.txt", spec_dir);

    FILE *f = fopen(path, "r");
    if (!f) {
        fprintf(stderr, "Error: Cannot open system prompt: %s\n", path);
        exit(1);
    }

    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);

    char *tmpl = (char *)malloc((size_t)size + 1);
    fread(tmpl, 1, (size_t)size, f);
    tmpl[size] = '\0';
    fclose(f);

    /* Replace {PROJECT_PATH} with the actual project_path */
    const char *placeholder = "{PROJECT_PATH}";
    size_t plen = strlen(placeholder);
    size_t vlen = strlen(project_path);

    /* Count occurrences */
    int count = 0;
    const char *p = tmpl;
    while ((p = strstr(p, placeholder)) != NULL) {
        count++;
        p += plen;
    }

    /* Allocate result */
    size_t result_size = (size_t)size - (size_t)count * plen + (size_t)count * vlen + 1;
    char *result = (char *)malloc(result_size);
    char *dst    = result;
    const char *src = tmpl;

    while (*src) {
        if (strncmp(src, placeholder, plen) == 0) {
            memcpy(dst, project_path, vlen);
            dst += vlen;
            src += plen;
        } else {
            *dst++ = *src++;
        }
    }
    *dst = '\0';

    free(tmpl);
    return result;
}

char *get_user_prompt(const char *project_path) {
    char *buf = (char *)malloc(strlen(project_path) + 256);
    sprintf(buf,
        "The project at %s has several bugs causing production errors. "
        "Find and fix all of them. Start by examining the error logs in the logs/ directory.",
        project_path);
    return buf;
}
