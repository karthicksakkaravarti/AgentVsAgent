/*
 * Block 4: Tool Registry
 */
#include "registry.h"
#include "tools/tools.h"
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <stdio.h>

typedef char *(*ToolFn)(const char *args_json, const char *project_path);

typedef struct {
    const char *name;
    ToolFn      fn;
} ToolEntry;

static ToolEntry registry[] = {
    { "search_files",    tool_search_files    },
    { "read_file",       tool_read_file       },
    { "write_file",      tool_write_file      },
    { "list_directory",  tool_list_directory  },
    { "execute_command", tool_execute_command },
    { "analyze_code",    tool_analyze_code    },
    { NULL, NULL }
};

static double now_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1000.0 + ts.tv_nsec / 1.0e6;
}

ToolExecResult execute_tool(const char *tool_call_id, const char *tool_name,
                             const char *args_json,    const char *project_path) {
    ToolExecResult r;
    memset(&r, 0, sizeof(r));
    strncpy(r.tool_call_id, tool_call_id, 255);
    strncpy(r.tool_name,    tool_name,    255);

    ToolFn fn = NULL;
    for (int i = 0; registry[i].name; i++) {
        if (strcmp(registry[i].name, tool_name) == 0) {
            fn = registry[i].fn;
            break;
        }
    }

    if (!fn) {
        char buf[512];
        snprintf(buf, sizeof(buf), "Error: Unknown tool \"%s\"", tool_name);
        r.result             = strdup(buf);
        r.execution_time_ms  = 0.0;
        return r;
    }

    double start    = now_ms();
    r.result        = fn(args_json, project_path);
    r.execution_time_ms = now_ms() - start;
    return r;
}
