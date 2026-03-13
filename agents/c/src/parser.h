/*
 * Block 3: Parser / Output Extractor
 * Parses raw API JSON response into a typed result.
 */
#ifndef PARSER_H
#define PARSER_H

#define PARSE_RESULT_FINAL_ANSWER 0
#define PARSE_RESULT_TOOL_CALLS   1
#define PARSE_RESULT_ERROR        2

#define MAX_TOOL_CALLS 64

typedef struct {
    char  id[256];
    char  name[256];
    char *arguments; /* heap-allocated JSON string */
} ToolCall;

typedef struct {
    int      type;             /* PARSE_RESULT_* */
    char    *content;          /* heap-allocated; may be NULL */
    char    *error_message;    /* heap-allocated; set for ERROR type */
    char    *tool_calls_json;  /* raw JSON array string for state storage */
    ToolCall tool_calls[MAX_TOOL_CALLS];
    int      tool_call_count;
} ParseResult;

ParseResult parse_response(const char *body);
void        parse_result_free(ParseResult *r);

#endif /* PARSER_H */
