/*
 * utils.h - Dynamic string buffer (StrBuf) used across all C agent modules.
 */
#ifndef UTILS_H
#define UTILS_H

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdarg.h>

typedef struct {
    char  *data;
    size_t len;
    size_t cap;
} StrBuf;

static inline void strbuf_init(StrBuf *b, size_t initial_cap) {
    b->data    = (char *)malloc(initial_cap);
    b->data[0] = '\0';
    b->len     = 0;
    b->cap     = initial_cap;
}

static inline void strbuf_grow(StrBuf *b, size_t needed) {
    if (b->len + needed + 1 > b->cap) {
        while (b->cap < b->len + needed + 1) b->cap *= 2;
        b->data = (char *)realloc(b->data, b->cap);
    }
}

static inline void strbuf_append(StrBuf *b, const char *str) {
    size_t n = strlen(str);
    strbuf_grow(b, n);
    memcpy(b->data + b->len, str, n + 1);
    b->len += n;
}

static inline void strbuf_appendn(StrBuf *b, const char *str, size_t n) {
    strbuf_grow(b, n);
    memcpy(b->data + b->len, str, n);
    b->len += n;
    b->data[b->len] = '\0';
}

static inline void strbuf_appendf(StrBuf *b, const char *fmt, ...) {
    va_list args, args2;
    va_start(args, fmt);
    va_copy(args2, args);
    int needed = vsnprintf(NULL, 0, fmt, args2);
    va_end(args2);
    if (needed < 0) { va_end(args); return; }
    strbuf_grow(b, (size_t)needed);
    vsnprintf(b->data + b->len, (size_t)needed + 1, fmt, args);
    b->len += (size_t)needed;
    va_end(args);
}

static inline void strbuf_free(StrBuf *b) {
    free(b->data);
    b->data = NULL;
    b->len  = 0;
    b->cap  = 0;
}

#endif /* UTILS_H */
