/*
 * Block 5: Orchestration Loop (The Engine / ReAct Loop)
 *
 * Ties all 5 building blocks together:
 *   1. Load System Prompt (prompt.h)
 *   2. Initialize State   (state.h)
 *   3. Parse response     (parser.h)
 *   4. Execute tools      (registry.h)
 *   5. Loop until "stop"
 *
 * HTTP via libcurl; JSON via bundled cJSON.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <curl/curl.h>

#include "prompt.h"
#include "state.h"
#include "parser.h"
#include "registry.h"
#include "utils.h"
#include "vendor/cJSON.h"

#define MAX_STEPS 200

/* ------------------------------------------------------------------ */
/* libcurl write callback — appends data to a StrBuf                  */
/* ------------------------------------------------------------------ */
static size_t write_cb(char *ptr, size_t size, size_t nmemb, void *userdata) {
    StrBuf *buf   = (StrBuf *)userdata;
    size_t  total = size * nmemb;
    strbuf_appendn(buf, ptr, total);
    return total;
}

/* ------------------------------------------------------------------ */
/* Monotonic clock helper                                               */
/* ------------------------------------------------------------------ */
static double now_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1000.0 + ts.tv_nsec / 1.0e6;
}

/* ------------------------------------------------------------------ */
/* Send one chat-completion request, return heap-allocated body.       */
/* ------------------------------------------------------------------ */
static char *send_chat_completion(const char *api_url,   const char *session_id,
                                   const StateManager *state, const char *tools_json) {
    /* Build JSON payload */
    cJSON *body     = cJSON_CreateObject();
    cJSON_AddStringToObject(body, "model", "gpt-4");
    cJSON *messages = state_to_json(state);
    cJSON_AddItemToObject(body, "messages", messages);
    cJSON *tools    = cJSON_Parse(tools_json);
    if (tools) cJSON_AddItemToObject(body, "tools", tools);

    char *payload = cJSON_PrintUnformatted(body);
    cJSON_Delete(body);

    /* Build URL */
    char url[1024];
    snprintf(url, sizeof(url), "%s/v1/chat/completions", api_url);

    /* Auth headers */
    char auth_hdr[512], session_hdr[512];
    snprintf(auth_hdr,    sizeof(auth_hdr),    "Authorization: Bearer %s", session_id);
    snprintf(session_hdr, sizeof(session_hdr), "X-Session-Id: %s",        session_id);

    StrBuf resp;
    strbuf_init(&resp, 65536);

    CURL *curl = curl_easy_init();
    if (!curl) { free(payload); strbuf_free(&resp); return NULL; }

    struct curl_slist *hdrs = NULL;
    hdrs = curl_slist_append(hdrs, "Content-Type: application/json");
    hdrs = curl_slist_append(hdrs, auth_hdr);
    hdrs = curl_slist_append(hdrs, session_hdr);

    curl_easy_setopt(curl, CURLOPT_URL,           url);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS,     payload);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER,     hdrs);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION,  write_cb);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA,      &resp);

    CURLcode res = curl_easy_perform(curl);

    curl_slist_free_all(hdrs);
    curl_easy_cleanup(curl);
    free(payload);

    if (res != CURLE_OK) {
        fprintf(stderr, "curl error: %s\n", curl_easy_strerror(res));
        strbuf_free(&resp);
        return NULL;
    }

    return resp.data; /* caller frees */
}

/* ------------------------------------------------------------------ */
/* main                                                                 */
/* ------------------------------------------------------------------ */
int main(void) {
    double agent_start = now_ms();

    /* --- Environment --- */
    const char *api_url = getenv("MOCK_API_URL");
    if (!api_url) api_url = "http://localhost:8080";

    const char *session_id = getenv("SESSION_ID");
    char default_session[64];
    if (!session_id) {
        snprintf(default_session, sizeof(default_session), "c-agent-%ld", (long)time(NULL));
        session_id = default_session;
    }

    const char *project_path = getenv("PROJECT_PATH");
    if (!project_path)
        project_path = "../../../target-project/generated";

    printf("=== C Agent Starting ===\n");
    printf("  API: %s\n",     api_url);
    printf("  Session: %s\n", session_id);
    printf("  Project: %s\n", project_path);
    printf("\n");

    /* --- Load tools schema --- */
    const char *spec_dir = "../spec";
    char schema_path[4096];
    snprintf(schema_path, sizeof(schema_path), "%s/tools-schema.json", spec_dir);

    FILE *sf = fopen(schema_path, "r");
    if (!sf) {
        fprintf(stderr, "Error: Cannot open tools schema: %s\n", schema_path);
        return 1;
    }
    fseek(sf, 0, SEEK_END);
    long schema_size = ftell(sf);
    fseek(sf, 0, SEEK_SET);
    char *schema_text = (char *)malloc((size_t)schema_size + 1);
    fread(schema_text, 1, (size_t)schema_size, sf);
    schema_text[schema_size] = '\0';
    fclose(sf);

    cJSON *schema_root = cJSON_Parse(schema_text);
    free(schema_text);
    cJSON *tools_arr   = schema_root ? cJSON_GetObjectItem(schema_root, "tools") : NULL;
    char  *tools_json  = tools_arr   ? cJSON_PrintUnformatted(tools_arr) : strdup("[]");

    /* --- Block 1: Load system prompt --- */
    char *system_prompt = load_system_prompt(project_path, spec_dir);
    char *user_prompt   = get_user_prompt(project_path);

    /* --- Block 2: Initialize state --- */
    StateManager state;
    state_init(&state);
    state_initialize(&state, system_prompt, user_prompt);

    /* --- Timing accumulators --- */
    int api_calls = 0;

#define MAX_TOOL_TYPES 16
#define MAX_TIMES      500
    char   tool_names[MAX_TOOL_TYPES][256];
    int    tool_counts[MAX_TOOL_TYPES];
    double tool_total_ms[MAX_TOOL_TYPES];
    double tool_times[MAX_TOOL_TYPES][MAX_TIMES];
    int    tool_times_n[MAX_TOOL_TYPES];
    int    num_tool_types = 0;

    memset(tool_counts,   0, sizeof(tool_counts));
    memset(tool_total_ms, 0, sizeof(tool_total_ms));
    memset(tool_times_n,  0, sizeof(tool_times_n));

    /* --- Block 5: Orchestration loop --- */
    curl_global_init(CURL_GLOBAL_DEFAULT);

    int step = 0;
    while (step < MAX_STEPS) {
        step++;

        size_t size_bytes = state_get_serialized_size(&state);
        printf("[Step %d] Sending request to API (%d messages, ~%zuKB)...\n",
               step, state_get_count(&state), size_bytes / 1024);

        char *body = send_chat_completion(api_url, session_id, &state, tools_json);
        if (!body) {
            fprintf(stderr, "Error: API request failed\n");
            break;
        }
        api_calls++;

        /* --- Block 3: Parse response --- */
        ParseResult result = parse_response(body);
        free(body);

        if (result.type == PARSE_RESULT_ERROR) {
            printf("[Step %d] Parse error: %s\n", step, result.error_message);
            parse_result_free(&result);
            break;
        }

        if (result.type == PARSE_RESULT_FINAL_ANSWER) {
            printf("[Step %d] Final answer received.\n\n", step);
            printf("=== Agent Summary ===\n");
            if (result.content) {
                int plen = (int)strlen(result.content);
                if (plen > 500) plen = 500;
                printf("%.*s\n", plen, result.content);
            }
            parse_result_free(&result);
            break;
        }

        if (result.type == PARSE_RESULT_TOOL_CALLS) {
            /* Add assistant message to state */
            state_add_assistant_message(&state, result.content, result.tool_calls_json);

            for (int i = 0; i < result.tool_call_count; i++) {
                ToolCall *tc = &result.tool_calls[i];

                int alen = (int)strlen(tc->arguments);
                if (alen > 80) alen = 80;
                printf("  [Tool] %s(%.*s...)\n", tc->name, alen, tc->arguments);

                /* --- Block 4: Execute tool --- */
                ToolExecResult exec = execute_tool(
                    tc->id, tc->name, tc->arguments, project_path);

                /* Record timing */
                int tidx = -1;
                for (int j = 0; j < num_tool_types; j++) {
                    if (strcmp(tool_names[j], tc->name) == 0) { tidx = j; break; }
                }
                if (tidx < 0 && num_tool_types < MAX_TOOL_TYPES) {
                    tidx = num_tool_types++;
                    strncpy(tool_names[tidx], tc->name, 255);
                }
                if (tidx >= 0) {
                    tool_counts[tidx]++;
                    tool_total_ms[tidx] += exec.execution_time_ms;
                    if (tool_times_n[tidx] < MAX_TIMES)
                        tool_times[tidx][tool_times_n[tidx]++] = exec.execution_time_ms;
                }

                printf("  [Tool] %s completed in %.1fms (%zu chars)\n",
                       exec.tool_name, exec.execution_time_ms, strlen(exec.result));

                /* Add tool result to state (Observe) */
                state_add_tool_result(&state, tc->id, exec.result);
                free(exec.result);
            }

            parse_result_free(&result);
        }
    }

    curl_global_cleanup();

    if (step >= MAX_STEPS)
        fprintf(stderr, "Agent hit maximum step limit (%d)\n", MAX_STEPS);

    /* --- Timing output --- */
    double agent_total_ms = now_ms() - agent_start;

    printf("\n=== Agent completed in %.2fs (%d API calls) ===\n",
           agent_total_ms / 1000.0, api_calls);

    cJSON *timing          = cJSON_CreateObject();
    cJSON_AddNumberToObject(timing, "agent_total_ms", agent_total_ms);
    cJSON_AddNumberToObject(timing, "api_calls",      api_calls);

    cJSON *tool_executions = cJSON_CreateObject();
    for (int i = 0; i < num_tool_types; i++) {
        cJSON *te = cJSON_CreateObject();
        cJSON_AddNumberToObject(te, "count",    tool_counts[i]);
        cJSON_AddNumberToObject(te, "total_ms", tool_total_ms[i]);
        cJSON *times_arr = cJSON_CreateArray();
        for (int j = 0; j < tool_times_n[i]; j++)
            cJSON_AddItemToArray(times_arr,
                                 cJSON_CreateNumber(tool_times[i][j]));
        cJSON_AddItemToObject(te, "times_ms", times_arr);
        cJSON_AddItemToObject(tool_executions, tool_names[i], te);
    }
    cJSON_AddItemToObject(timing, "tool_executions", tool_executions);

    char *timing_str = cJSON_PrintUnformatted(timing);
    printf("%s\n", timing_str);

    /* Cleanup */
    free(timing_str);
    cJSON_Delete(timing);
    if (schema_root) cJSON_Delete(schema_root);
    free(tools_json);
    free(system_prompt);
    free(user_prompt);

    return 0;
}
