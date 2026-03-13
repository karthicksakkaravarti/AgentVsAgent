/*
 * Block 4: Tool Registry
 * Dispatches tool calls by name and records execution time.
 */
#ifndef REGISTRY_H
#define REGISTRY_H

typedef struct {
    char  tool_call_id[256];
    char  tool_name[256];
    char *result;            /* heap-allocated — caller must free */
    double execution_time_ms;
} ToolExecResult;

ToolExecResult execute_tool(const char *tool_call_id, const char *tool_name,
                             const char *args_json,    const char *project_path);

#endif /* REGISTRY_H */
