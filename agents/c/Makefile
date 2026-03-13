CC      = gcc
CFLAGS  = -std=c11 -Wall -Wextra -Wno-unused-parameter -O2 \
          -D_POSIX_C_SOURCE=200809L \
          -I. -Isrc
LDFLAGS = $(shell pkg-config --libs libcurl 2>/dev/null || echo -lcurl)
TARGET  = bin/agent

VENDOR_SRCS = vendor/cJSON.c
SRC_SRCS    = src/main.c \
              src/prompt.c \
              src/state.c \
              src/parser.c \
              src/registry.c \
              src/tools/search_files.c \
              src/tools/read_file.c \
              src/tools/write_file.c \
              src/tools/list_directory.c \
              src/tools/execute_command.c \
              src/tools/analyze_code.c

SRCS = $(VENDOR_SRCS) $(SRC_SRCS)
OBJS = $(SRCS:.c=.o)

.PHONY: all clean

all: $(TARGET)

$(TARGET): $(OBJS)
	@mkdir -p bin
	$(CC) $(OBJS) -o $(TARGET) $(LDFLAGS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f $(OBJS) $(TARGET)
