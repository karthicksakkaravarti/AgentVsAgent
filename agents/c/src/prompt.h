/*
 * Block 1: System Prompt & Persona
 * Loads the shared system prompt and prepares it with the project path.
 */
#ifndef PROMPT_H
#define PROMPT_H

/* Returns heap-allocated string — caller must free. */
char *load_system_prompt(const char *project_path, const char *spec_dir);
char *get_user_prompt(const char *project_path);

#endif /* PROMPT_H */
