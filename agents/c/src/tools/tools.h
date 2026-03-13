/*
 * tools.h - Forward declarations for all 6 agent tools.
 * Each tool receives a JSON arguments string and the project root path.
 * Returns a heap-allocated result string that the caller must free().
 */
#ifndef TOOLS_H
#define TOOLS_H

char *tool_search_files(const char *args_json, const char *project_path);
char *tool_read_file(const char *args_json, const char *project_path);
char *tool_write_file(const char *args_json, const char *project_path);
char *tool_list_directory(const char *args_json, const char *project_path);
char *tool_execute_command(const char *args_json, const char *project_path);
char *tool_analyze_code(const char *args_json, const char *project_path);

#endif /* TOOLS_H */
