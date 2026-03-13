/*
 * Tool: analyze_code — regex-based code structure analysis.
 * Uses POSIX ERE (regex.h). Patterns ported from the Python implementation.
 */
#include "tools.h"
#include "../utils.h"
#include "vendor/cJSON.h"
#include <regex.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

/* Read entire file into a heap-allocated string. */
static char *read_content(const char *path) {
    FILE *f = fopen(path, "r");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);
    char *buf = (char *)malloc((size_t)size + 1);
    fread(buf, 1, (size_t)size, f);
    buf[size] = '\0';
    fclose(f);
    return buf;
}

/*
 * Iterate over all matches of `pattern` in `text` (multiline is handled by
 * treating the whole buffer as one string — POSIX `^`/`$` match start/end of
 * string by default, not newlines.  For line-oriented patterns we walk
 * line-by-line instead).
 */

/* Collect all matches of a capture group (group_idx) into out. */
static void collect_matches(const char *text, const char *pattern,
                             int group_idx, const char *prefix, StrBuf *out) {
    regex_t re;
    if (regcomp(&re, pattern, REG_EXTENDED) != 0) return;

    regmatch_t m[8];
    const char *p = text;
    while (regexec(&re, p, (size_t)(group_idx + 1), m, 0) == 0) {
        if (m[group_idx].rm_so >= 0) {
            size_t len = (size_t)(m[group_idx].rm_eo - m[group_idx].rm_so);
            char match[512];
            if (len > 511) len = 511;
            strncpy(match, p + m[group_idx].rm_so, len);
            match[len] = '\0';
            strbuf_appendf(out, "  %s%s\n", prefix, match);
        }
        /* Advance past the match */
        size_t adv = (size_t)(m[0].rm_eo > 0 ? m[0].rm_eo : 1);
        p += adv;
    }
    regfree(&re);
}

/* Count non-overlapping matches of pattern. */
static int count_matches(const char *text, const char *pattern) {
    regex_t re;
    if (regcomp(&re, pattern, REG_EXTENDED) != 0) return 0;
    int count = 0;
    regmatch_t m;
    const char *p = text;
    while (regexec(&re, p, 1, &m, 0) == 0) {
        count++;
        size_t adv = (size_t)(m.rm_eo > 0 ? m.rm_eo : 1);
        p += adv;
    }
    regfree(&re);
    return count;
}

static char *analyze_imports(const char *content, const char *file_path) {
    StrBuf out;
    strbuf_init(&out, 4096);
    strbuf_appendf(&out, "=== Import Analysis: %s ===\n", file_path);

    int found = 0;

    /* ES6: import ... from "..." */
    {
        regex_t re;
        if (regcomp(&re, "from[[:space:]]+[\"']([^\"']+)[\"']", REG_EXTENDED) == 0) {
            regmatch_t m[2];
            const char *p = content;
            while (regexec(&re, p, 2, m, 0) == 0) {
                if (m[1].rm_so >= 0) {
                    size_t len = (size_t)(m[1].rm_eo - m[1].rm_so);
                    char src[256] = "";
                    if (len > 255) len = 255;
                    strncpy(src, p + m[1].rm_so, len);
                    strbuf_appendf(&out, "  import from \"%s\"\n", src);
                    found = 1;
                }
                p += m[0].rm_eo > 0 ? m[0].rm_eo : 1;
            }
            regfree(&re);
        }
    }

    /* Python: import X */
    {
        regex_t re;
        if (regcomp(&re, "(^|\\n)import ([^\n]+)", REG_EXTENDED) == 0) {
            regmatch_t m[3];
            const char *p = content;
            while (regexec(&re, p, 3, m, 0) == 0) {
                if (m[2].rm_so >= 0) {
                    size_t len = (size_t)(m[2].rm_eo - m[2].rm_so);
                    char names[256] = "";
                    if (len > 255) len = 255;
                    strncpy(names, p + m[2].rm_so, len);
                    strbuf_appendf(&out, "  import %s\n", names);
                    found = 1;
                }
                p += m[0].rm_eo > 0 ? m[0].rm_eo : 1;
            }
            regfree(&re);
        }
    }

    if (!found) strbuf_append(&out, "  No imports found\n");
    if (out.len > 0 && out.data[out.len - 1] == '\n') out.data[--out.len] = '\0';
    return out.data;
}

static char *analyze_exports(const char *content, const char *file_path) {
    StrBuf out;
    strbuf_init(&out, 4096);
    strbuf_appendf(&out, "=== Export Analysis: %s ===\n", file_path);

    int found = 0;

    /* named exports */
    collect_matches(content,
        "export[[:space:]]+(const|let|var|function|class|interface|type|enum)[[:space:]]+([[:alnum:]_]+)",
        2, "named: ", &out);

    /* default exports */
    {
        regex_t re;
        if (regcomp(&re, "export[[:space:]]+default[[:space:]]+(class|function)?[[:space:]]*([[:alnum:]_]*)", REG_EXTENDED) == 0) {
            regmatch_t m[3];
            const char *p = content;
            while (regexec(&re, p, 3, m, 0) == 0) {
                char name[64] = "(anonymous)";
                if (m[2].rm_so >= 0 && m[2].rm_eo > m[2].rm_so) {
                    size_t len = (size_t)(m[2].rm_eo - m[2].rm_so);
                    if (len > 63) len = 63;
                    strncpy(name, p + m[2].rm_so, len);
                    name[len] = '\0';
                }
                strbuf_appendf(&out, "  default: %s\n", name);
                found = 1;
                p += m[0].rm_eo > 0 ? m[0].rm_eo : 1;
            }
            regfree(&re);
        }
    }

    /* Check if named exports were found */
    if (strstr(out.data, "  named:")) found = 1;
    if (!found) strbuf_append(&out, "  No exports found\n");
    if (out.len > 0 && out.data[out.len - 1] == '\n') out.data[--out.len] = '\0';
    return out.data;
}

static char *analyze_functions(const char *content, const char *file_path) {
    StrBuf out;
    strbuf_init(&out, 4096);
    strbuf_appendf(&out, "=== Function Analysis: %s ===\n", file_path);

    int found = 0;

    /* JS/TS: function name(...) */
    {
        regex_t re;
        if (regcomp(&re,
            "(export[[:space:]]+)?(async[[:space:]]+)?function[[:space:]]+([[:alnum:]_]+)[[:space:]]*\\(([^)]*?)\\)",
            REG_EXTENDED) == 0) {
            regmatch_t m[5];
            const char *p = content;
            while (regexec(&re, p, 5, m, 0) == 0) {
                char name[128]   = "";
                char params[256] = "";
                if (m[3].rm_so >= 0) {
                    size_t l = (size_t)(m[3].rm_eo - m[3].rm_so);
                    if (l > 127) l = 127;
                    strncpy(name, p + m[3].rm_so, l);
                }
                if (m[4].rm_so >= 0) {
                    size_t l = (size_t)(m[4].rm_eo - m[4].rm_so);
                    if (l > 255) l = 255;
                    strncpy(params, p + m[4].rm_so, l);
                }
                strbuf_appendf(&out, "  function %s(%s)\n", name,
                               strlen(params) ? params : "none");
                found = 1;
                p += m[0].rm_eo > 0 ? m[0].rm_eo : 1;
            }
            regfree(&re);
        }
    }

    /* Python: def name(...) */
    collect_matches(content,
        "^def[[:space:]]+([[:alnum:]_]+)[[:space:]]*\\(",
        1, "def ", &out);
    if (strstr(out.data, "  def ")) found = 1;

    if (!found) strbuf_append(&out, "  No functions found\n");
    if (out.len > 0 && out.data[out.len - 1] == '\n') out.data[--out.len] = '\0';
    return out.data;
}

static char *analyze_classes(const char *content, const char *file_path) {
    StrBuf out;
    strbuf_init(&out, 4096);
    strbuf_appendf(&out, "=== Class Analysis: %s ===\n", file_path);

    int found = 0;

    /* JS/TS: class Name [extends Base] */
    {
        regex_t re;
        if (regcomp(&re,
            "(export[[:space:]]+)?(abstract[[:space:]]+)?class[[:space:]]+([[:alnum:]_]+)([[:space:]]+extends[[:space:]]+([[:alnum:]_]+))?",
            REG_EXTENDED) == 0) {
            regmatch_t m[6];
            const char *p = content;
            while (regexec(&re, p, 6, m, 0) == 0) {
                char name[128] = "";
                char base[128] = "";
                if (m[3].rm_so >= 0) {
                    size_t l = (size_t)(m[3].rm_eo - m[3].rm_so);
                    if (l > 127) l = 127;
                    strncpy(name, p + m[3].rm_so, l);
                }
                if (m[5].rm_so >= 0) {
                    size_t l = (size_t)(m[5].rm_eo - m[5].rm_so);
                    if (l > 127) l = 127;
                    strncpy(base, p + m[5].rm_so, l);
                }
                if (strlen(base))
                    strbuf_appendf(&out, "  class %s extends %s\n", name, base);
                else
                    strbuf_appendf(&out, "  class %s\n", name);
                found = 1;
                p += m[0].rm_eo > 0 ? m[0].rm_eo : 1;
            }
            regfree(&re);
        }
    }

    if (!found) strbuf_append(&out, "  No classes found\n");
    if (out.len > 0 && out.data[out.len - 1] == '\n') out.data[--out.len] = '\0';
    return out.data;
}

static char *analyze_errors(const char *content, const char *file_path) {
    StrBuf out;
    strbuf_init(&out, 2048);
    strbuf_appendf(&out, "=== Error Handling Analysis: %s ===\n", file_path);

    int try_count   = count_matches(content, "try[[:space:]]*[:{]");
    int throw_count = count_matches(content, "throw[[:space:]]+new[[:space:]]+[[:alnum:]_]+");
    int raise_count = count_matches(content, "raise[[:space:]]+[[:alnum:]_]+");
    int catch_count = count_matches(content, "\\.catch[[:space:]]*\\(");

    strbuf_appendf(&out, "  try-catch/except blocks: %d\n", try_count);
    strbuf_appendf(&out, "  throw/raise statements: %d\n", throw_count + raise_count);
    strbuf_appendf(&out, "  .catch() calls: %d\n", catch_count);

    if (out.len > 0 && out.data[out.len - 1] == '\n') out.data[--out.len] = '\0';
    return out.data;
}

static char *analyze_dependencies(const char *content, const char *file_path) {
    StrBuf out;
    strbuf_init(&out, 4096);
    strbuf_appendf(&out, "=== Dependency Analysis: %s ===\n", file_path);

    /* Collect unique deps in a simple fixed array (max 512) */
#define MAX_DEPS 512
    char *deps[MAX_DEPS];
    int   ndeps = 0;

    /* Patterns to extract module paths */
    const char *patterns[] = {
        "from[[:space:]]+[\"']([^\"']+)[\"']",
        "require\\([[:space:]]*[\"']([^\"']+)[\"']",
        NULL
    };

    for (int pi = 0; patterns[pi]; pi++) {
        regex_t re;
        if (regcomp(&re, patterns[pi], REG_EXTENDED) != 0) continue;
        regmatch_t m[2];
        const char *p = content;
        while (regexec(&re, p, 2, m, 0) == 0) {
            if (m[1].rm_so >= 0 && ndeps < MAX_DEPS) {
                size_t len = (size_t)(m[1].rm_eo - m[1].rm_so);
                if (len > 255) len = 255;
                char *dep = (char *)malloc(len + 1);
                strncpy(dep, p + m[1].rm_so, len);
                dep[len] = '\0';
                /* Dedup check */
                int dup = 0;
                for (int j = 0; j < ndeps; j++)
                    if (strcmp(deps[j], dep) == 0) { dup = 1; break; }
                if (!dup) deps[ndeps++] = dep;
                else free(dep);
            }
            p += m[0].rm_eo > 0 ? m[0].rm_eo : 1;
        }
        regfree(&re);
    }

    /* Sort */
    for (int i = 0; i < ndeps - 1; i++)
        for (int j = i + 1; j < ndeps; j++)
            if (strcmp(deps[i], deps[j]) > 0) {
                char *tmp = deps[i]; deps[i] = deps[j]; deps[j] = tmp;
            }

    int n_local = 0, n_ext = 0;
    for (int i = 0; i < ndeps; i++)
        if (deps[i][0] == '.' || deps[i][0] == '/') n_local++; else n_ext++;

    strbuf_appendf(&out, "  Local dependencies (%d):\n", n_local);
    for (int i = 0; i < ndeps; i++)
        if (deps[i][0] == '.' || deps[i][0] == '/')
            strbuf_appendf(&out, "    - %s\n", deps[i]);

    strbuf_appendf(&out, "  External dependencies (%d):\n", n_ext);
    for (int i = 0; i < ndeps; i++)
        if (deps[i][0] != '.' && deps[i][0] != '/')
            strbuf_appendf(&out, "    - %s\n", deps[i]);

    for (int i = 0; i < ndeps; i++) free(deps[i]);

    if (out.len > 0 && out.data[out.len - 1] == '\n') out.data[--out.len] = '\0';
    return out.data;
}

/* ------------------------------------------------------------------ */

char *tool_analyze_code(const char *args_json, const char *project_path) {
    cJSON *args = cJSON_Parse(args_json);
    if (!args) return strdup("Error: Failed to parse arguments");

    cJSON *path_obj     = cJSON_GetObjectItem(args, "path");
    cJSON *analysis_obj = cJSON_GetObjectItem(args, "analysis");

    if (!path_obj || !cJSON_IsString(path_obj)) {
        cJSON_Delete(args);
        return strdup("Error: path is required");
    }

    const char *file_path = path_obj->valuestring;
    const char *analysis  = (analysis_obj && cJSON_IsString(analysis_obj))
                            ? analysis_obj->valuestring : "functions";
    cJSON_Delete(args);

    char full_path[4096];
    if (file_path[0] == '/') {
        strncpy(full_path, file_path, sizeof(full_path) - 1);
    } else {
        snprintf(full_path, sizeof(full_path), "%s/%s", project_path, file_path);
    }

    char *content = read_content(full_path);
    if (!content) {
        char buf[512];
        snprintf(buf, sizeof(buf), "Error: File not found: %s", file_path);
        return strdup(buf);
    }

    char *result = NULL;
    if      (strcmp(analysis, "imports")      == 0) result = analyze_imports(content, file_path);
    else if (strcmp(analysis, "exports")      == 0) result = analyze_exports(content, file_path);
    else if (strcmp(analysis, "functions")    == 0) result = analyze_functions(content, file_path);
    else if (strcmp(analysis, "classes")      == 0) result = analyze_classes(content, file_path);
    else if (strcmp(analysis, "errors")       == 0) result = analyze_errors(content, file_path);
    else if (strcmp(analysis, "dependencies") == 0) result = analyze_dependencies(content, file_path);
    else {
        char buf[256];
        snprintf(buf, sizeof(buf), "Error: Unknown analysis type \"%s\"", analysis);
        result = strdup(buf);
    }

    free(content);
    return result;
}
