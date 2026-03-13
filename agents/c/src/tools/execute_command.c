/*
 * Tool: execute_command — run shell commands with timeout via popen.
 */
#include "tools.h"
#include "../utils.h"
#include "vendor/cJSON.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>

char *tool_execute_command(const char *args_json, const char *project_path) {
    cJSON *args = cJSON_Parse(args_json);
    if (!args) return strdup("Error: Failed to parse arguments");

    cJSON *cmd_obj     = cJSON_GetObjectItem(args, "command");
    cJSON *timeout_obj = cJSON_GetObjectItem(args, "timeout");

    if (!cmd_obj || !cJSON_IsString(cmd_obj)) {
        cJSON_Delete(args);
        return strdup("Error: command is required");
    }

    const char *command     = cmd_obj->valuestring;
    int         timeout_ms  = (timeout_obj && cJSON_IsNumber(timeout_obj))
                                ? (int)timeout_obj->valuedouble : 30000;
    int         timeout_sec = timeout_ms / 1000;
    if (timeout_sec < 1) timeout_sec = 1;

    /*
     * Build shell invocation:
     *   cd '<project>' && timeout <sec> sh -c '<command>' 2>&1
     * We merge stderr into stdout for simplicity (same effective output for
     * the agent; the Python agent keeps them separate but both are shown).
     */
    char shell_cmd[8192];
    snprintf(shell_cmd, sizeof(shell_cmd),
             "cd '%s' && timeout %d sh -c '%s' 2>&1",
             project_path, timeout_sec, command);

    FILE *fp = popen(shell_cmd, "r");
    if (!fp) {
        cJSON_Delete(args);
        return strdup("Exit code: -1\nError: Failed to execute command");
    }

    StrBuf stdout_buf;
    strbuf_init(&stdout_buf, 16384);

    char buf[4096];
    while (fgets(buf, sizeof(buf), fp) != NULL)
        strbuf_append(&stdout_buf, buf);

    int status    = pclose(fp);
    int exit_code = WIFEXITED(status) ? WEXITSTATUS(status) : -1;

    cJSON_Delete(args);

    StrBuf out;
    strbuf_init(&out, stdout_buf.len + 128);
    strbuf_appendf(&out, "Exit code: %d\nStdout:\n", exit_code);
    strbuf_appendn(&out, stdout_buf.data, stdout_buf.len);
    strbuf_append(&out, "\nStderr:\n");

    strbuf_free(&stdout_buf);
    return out.data;
}
