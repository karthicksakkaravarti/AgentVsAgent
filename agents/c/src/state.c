/*
 * Block 2: State & Memory Manager
 */
#include "state.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

void state_init(StateManager *s) {
    s->count = 0;
}

static void add_message(StateManager *s, const char *role, const char *content,
                        const char *tool_calls_json, const char *tool_call_id) {
    if (s->count >= MAX_MESSAGES) {
        fprintf(stderr, "Warning: max messages (%d) reached\n", MAX_MESSAGES);
        return;
    }
    Message *m        = &s->messages[s->count++];
    m->role           = strdup(role);
    m->content        = content         ? strdup(content)         : NULL;
    m->tool_calls_json = tool_calls_json ? strdup(tool_calls_json) : NULL;
    m->tool_call_id   = tool_call_id    ? strdup(tool_call_id)    : NULL;
}

void state_initialize(StateManager *s, const char *system_prompt, const char *user_message) {
    s->count = 0;
    add_message(s, "system",    system_prompt, NULL, NULL);
    add_message(s, "user",      user_message,  NULL, NULL);
}

void state_add_assistant_message(StateManager *s, const char *content,
                                 const char *tool_calls_json) {
    add_message(s, "assistant", content, tool_calls_json, NULL);
}

void state_add_tool_result(StateManager *s, const char *tool_call_id, const char *result) {
    add_message(s, "tool", result, NULL, tool_call_id);
}

cJSON *state_to_json(const StateManager *s) {
    cJSON *arr = cJSON_CreateArray();
    for (int i = 0; i < s->count; i++) {
        const Message *m = &s->messages[i];
        cJSON *obj = cJSON_CreateObject();

        cJSON_AddStringToObject(obj, "role", m->role);

        if (m->content != NULL) {
            cJSON_AddStringToObject(obj, "content", m->content);
        } else {
            cJSON_AddNullToObject(obj, "content");
        }

        if (m->tool_calls_json != NULL) {
            cJSON *tc = cJSON_Parse(m->tool_calls_json);
            if (tc) {
                cJSON_AddItemToObject(obj, "tool_calls", tc);
            }
        }

        if (m->tool_call_id != NULL) {
            cJSON_AddStringToObject(obj, "tool_call_id", m->tool_call_id);
        }

        cJSON_AddItemToArray(arr, obj);
    }
    return arr;
}

int state_get_count(const StateManager *s) {
    return s->count;
}

size_t state_get_serialized_size(const StateManager *s) {
    cJSON *arr  = state_to_json(s);
    char  *str  = cJSON_PrintUnformatted(arr);
    size_t len  = strlen(str);
    free(str);
    cJSON_Delete(arr);
    return len;
}
