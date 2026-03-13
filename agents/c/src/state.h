/*
 * Block 2: State & Memory Manager
 * Maintains the growing messages list across the conversation loop.
 */
#ifndef STATE_H
#define STATE_H

#include "vendor/cJSON.h"
#include <stddef.h>

#define MAX_MESSAGES 1000

typedef struct {
    char *role;            /* "system" | "user" | "assistant" | "tool" */
    char *content;         /* may be NULL for assistant tool-call messages */
    char *tool_calls_json; /* raw JSON array string, or NULL */
    char *tool_call_id;    /* for "tool" role messages, or NULL */
} Message;

typedef struct {
    Message messages[MAX_MESSAGES];
    int     count;
} StateManager;

void   state_init(StateManager *s);
void   state_initialize(StateManager *s, const char *system_prompt, const char *user_message);
void   state_add_assistant_message(StateManager *s, const char *content, const char *tool_calls_json);
void   state_add_tool_result(StateManager *s, const char *tool_call_id, const char *result);
cJSON *state_to_json(const StateManager *s);
int    state_get_count(const StateManager *s);
size_t state_get_serialized_size(const StateManager *s);

#endif /* STATE_H */
