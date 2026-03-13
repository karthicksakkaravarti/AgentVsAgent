/*
 * Block 3: Parser / Output Extractor
 */
#include "parser.h"
#include "vendor/cJSON.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

ParseResult parse_response(const char *body) {
    ParseResult result;
    memset(&result, 0, sizeof(result));

    cJSON *root = cJSON_Parse(body);
    if (!root) {
        result.type          = PARSE_RESULT_ERROR;
        result.error_message = strdup("Failed to parse JSON response");
        return result;
    }

    cJSON *choices = cJSON_GetObjectItem(root, "choices");
    if (!choices || !cJSON_IsArray(choices) || cJSON_GetArraySize(choices) == 0) {
        result.type          = PARSE_RESULT_ERROR;
        result.error_message = strdup("Response has no choices");
        cJSON_Delete(root);
        return result;
    }

    cJSON *choice       = cJSON_GetArrayItem(choices, 0);
    cJSON *finish_obj   = cJSON_GetObjectItem(choice, "finish_reason");
    cJSON *message      = cJSON_GetObjectItem(choice, "message");
    cJSON *content_obj  = message ? cJSON_GetObjectItem(message, "content") : NULL;

    const char *finish_reason = (finish_obj && cJSON_IsString(finish_obj))
                                ? finish_obj->valuestring : NULL;
    const char *content       = (content_obj && cJSON_IsString(content_obj))
                                ? content_obj->valuestring : NULL;

    /* Final answer */
    if (finish_reason && strcmp(finish_reason, "stop") == 0) {
        result.type    = PARSE_RESULT_FINAL_ANSWER;
        result.content = strdup(content ? content : "");
        cJSON_Delete(root);
        return result;
    }

    /* Tool calls */
    if (finish_reason && strcmp(finish_reason, "tool_calls") == 0) {
        cJSON *tc_arr = message ? cJSON_GetObjectItem(message, "tool_calls") : NULL;
        if (!tc_arr || !cJSON_IsArray(tc_arr)) {
            result.type          = PARSE_RESULT_ERROR;
            result.error_message = strdup("finish_reason is tool_calls but no tool_calls found");
            cJSON_Delete(root);
            return result;
        }

        result.type           = PARSE_RESULT_TOOL_CALLS;
        result.content        = content ? strdup(content) : NULL;
        result.tool_calls_json = cJSON_PrintUnformatted(tc_arr);

        int n = cJSON_GetArraySize(tc_arr);
        if (n > MAX_TOOL_CALLS) n = MAX_TOOL_CALLS;
        result.tool_call_count = n;

        for (int i = 0; i < n; i++) {
            cJSON *tc      = cJSON_GetArrayItem(tc_arr, i);
            cJSON *id_obj  = cJSON_GetObjectItem(tc, "id");
            cJSON *func    = cJSON_GetObjectItem(tc, "function");
            cJSON *name_obj = func ? cJSON_GetObjectItem(func, "name")      : NULL;
            cJSON *args_obj = func ? cJSON_GetObjectItem(func, "arguments") : NULL;

            if (id_obj && cJSON_IsString(id_obj))
                strncpy(result.tool_calls[i].id,   id_obj->valuestring,   255);
            if (name_obj && cJSON_IsString(name_obj))
                strncpy(result.tool_calls[i].name, name_obj->valuestring, 255);

            result.tool_calls[i].arguments =
                (args_obj && cJSON_IsString(args_obj))
                ? strdup(args_obj->valuestring)
                : strdup("{}");
        }

        cJSON_Delete(root);
        return result;
    }

    /* Unknown finish_reason */
    result.type = PARSE_RESULT_ERROR;
    char buf[256];
    snprintf(buf, sizeof(buf), "Unknown finish_reason: %s",
             finish_reason ? finish_reason : "null");
    result.error_message = strdup(buf);
    cJSON_Delete(root);
    return result;
}

void parse_result_free(ParseResult *r) {
    free(r->content);
    free(r->error_message);
    free(r->tool_calls_json);
    for (int i = 0; i < r->tool_call_count; i++) {
        free(r->tool_calls[i].arguments);
    }
    memset(r, 0, sizeof(*r));
}
