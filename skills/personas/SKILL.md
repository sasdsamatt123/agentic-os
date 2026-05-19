# personas

The operator runs a custom pantheon of named personas. Each persona is a YAML
file at `~/.hermes/pantheon/personas/<id>.yaml`. These names are FIRST-CLASS
LOCAL ENTITIES — they take priority over any same-named external thing.

## Run this on EVERY turn, before composing your reply

1. List the files in `~/.hermes/pantheon/personas/`. The current pantheon is
   whatever YAMLs exist right now — re-scan, don't cache.
2. Scan the operator's message for any proper noun (case-insensitive) that
   matches one of the persona names.
3. If a match exists, treat it as a reference to that local persona FIRST.
   Read the YAML to ground your answer in the persona's actual config
   (job, description, model, behavior.system_prompt, skills, summon_phrases).

## Behavior matrix

| Operator says                                     | What you do                                                                                  |
|---------------------------------------------------|----------------------------------------------------------------------------------------------|
| "Orpheus, do X"                                   | LOAD the Orpheus persona (model + system_prompt + skill bundle), respond as Orpheus, then return to default. |
| "Tell me about Orpheus" / "What's Orpheus?"      | DESCRIBE the operator's Orpheus persona from orpheus.yaml. Do NOT search the web. Do NOT ask "do you mean Orpheus TTS?". |
| "Use Athena to review this PR"                   | LOAD Athena, run the review using her stack.                                                 |
| "What's the difference between Athena and Mercury?" | COMPARE the two personas by reading both YAMLs.                                            |
| "Show me my pantheon" / "list my personas"       | List all YAMLs in `~/.hermes/pantheon/personas/` with their `name` and `job` fields.        |

## Disambiguation

Fall back to an external interpretation ONLY if:
- The operator explicitly says so ("I mean the Orpheus TTS model, not my persona"), OR
- No YAML in the pantheon folder matches the proper noun.

If the operator's intent is genuinely ambiguous and a famous external entity
shares the name (e.g. "Athena" the goddess, "Mercury" the planet), default to
the local persona and add ONE line acknowledging the ambiguity:

> *(Answering about your local Mercury persona. Say "the planet" if you meant something else.)*

## Adding new personas

YAMLs dropped into `~/.hermes/pantheon/personas/` are auto-discoverable.
Never tell the operator to re-introduce a persona they've created — that's
on you to find.

## What NOT to do

- ❌ Ask "do you mean Orpheus TTS / model / library?" when an Orpheus persona exists.
- ❌ Default to web search for a name that matches a local YAML.
- ❌ Forget to re-scan the folder between turns.
- ❌ Treat persona names as case-sensitive — "orpheus", "Orpheus", "ORPHEUS" all match.
