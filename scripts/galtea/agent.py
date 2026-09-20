"""Run one Workflow Scout interview turn locally, exactly as make.com runs it.

In production the Scout 4 scenario sends the whole text of
prompts/02_interview_turn.md as the system prompt and one JSON object as the
user message, to Claude with temperature 0.2, and expects JSON only back.
This module reproduces that so Galtea can evaluate it as a local agent with no
endpoint deployed.

The fixed part of the JSON input is Elena Ruiz's Friday 18 September 2026, with
Scout's first question already asked. The only thing a test case changes is
Elena's reply, which becomes turn 2.
"""

import json
import os
import sys
from pathlib import Path

MODEL = "claude-sonnet-4-5"
TEMPERATURE = 0.2
MAX_TOKENS = 700

REPO_ROOT = Path(__file__).resolve().parents[2]
PROMPT_PATH = REPO_ROOT / "prompts" / "02_interview_turn.md"

TOPICS = [
    {
        "name": "Client delivery and workshops",
        "description": "Designing and running client workshops, leading the analysis and turning it into recommendations.",
        "expected_percent": 45,
    },
    {
        "name": "Client relationships",
        "description": "Regular calls, steering groups and day to day contact with each client's senior team.",
        "expected_percent": 20,
    },
    {
        "name": "Proposals and business development",
        "description": "Shaping proposals for new and extended engagements with evidence from live work.",
        "expected_percent": 15,
    },
    {
        "name": "Coaching juniors",
        "description": "Coaching the consultants and analysts on each account towards leading client sessions.",
        "expected_percent": 10,
    },
    {
        "name": "Internal meetings and administration",
        "description": "Team meetings, planning and keeping engagement records accurate.",
        "expected_percent": 10,
    },
]

CALENDAR_ACTIVITIES = [
    {
        "title": "Northmere Foods: steering group",
        "description": "Monthly steering group with Northmere's operations leadership.",
        "starts_at": "2026-09-18T11:00:00+02:00",
        "ends_at": "2026-09-18T12:00:00+02:00",
        "minutes": 60,
        "attendees": ["Elena Ruiz", "Tomas Berg", "Sophie Lindqvist", "Daniel Achterberg"],
    },
    {
        "title": "Client Delivery weekly review",
        "description": "Tomas's weekly review of margins and staffing across the team's accounts.",
        "starts_at": "2026-09-18T13:00:00+02:00",
        "ends_at": "2026-09-18T14:00:00+02:00",
        "minutes": 60,
        "attendees": ["Elena Ruiz", "Tomas Berg", "Priya Nair", "Jonas Weber"],
    },
    {
        "title": "Friday report send out",
        "description": "Send this week's pack to each client.",
        "starts_at": "2026-09-18T14:00:00+02:00",
        "ends_at": "2026-09-18T16:30:00+02:00",
        "minutes": 150,
        "attendees": ["Elena Ruiz"],
    },
    {
        "title": "Coaching: Jonas",
        "description": "Fortnightly coaching. Jonas to present the demand forecast to Northmere himself next month.",
        "starts_at": "2026-09-18T16:30:00+02:00",
        "ends_at": "2026-09-18T17:30:00+02:00",
        "minutes": 60,
        "attendees": ["Elena Ruiz", "Jonas Weber"],
    },
    {
        "title": "Plan next week",
        "description": "Set priorities for the week of 21 September.",
        "starts_at": "2026-09-18T17:30:00+02:00",
        "ends_at": "2026-09-18T18:00:00+02:00",
        "minutes": 30,
        "attendees": ["Elena Ruiz"],
    },
]

TRANSCRIPT_ACTIVITIES = [
    {
        "title": "Call from Northmere Foods about two figures in last week's status pack",
        "description": (
            "Sophie Lindqvist of Northmere Foods rang because two figures in last week's status pack "
            "did not match the project tracker. Elena explained that she copies the figures across by "
            "hand every Friday and agreed to send a corrected pack before 11:00."
        ),
        "starts_at": "2026-09-18T09:20:00+02:00",
        "ends_at": "2026-09-18T10:00:00+02:00",
        "minutes": 40,
        "attendees": ["Elena Ruiz", "Sophie Lindqvist"],
        "in_calendar": False,
    }
]

FIRST_SCOUT_TURN = {
    "turn_no": 1,
    "speaker": "scout",
    "text": (
        "Good morning Elena, thanks for taking a few minutes to tell me about Friday. Your calendar was "
        "empty from 09:00 to 11:00, two hours, and I can see the 40 minute call from Sophie Lindqvist at "
        "Northmere Foods at 09:20, so what were you working on for the rest of that time?"
    ),
    "kind": "calendar_gap",
    "evidence": (
        "Nothing in your calendar from 09:00 to 11:00. One unplanned 40 minute call with Northmere Foods "
        "was recorded at 09:20."
    ),
}


def load_system_prompt() -> str:
    """Read the whole interview prompt file, the same text make.com sends."""
    return PROMPT_PATH.read_text(encoding="utf-8")


def build_input(employee_text: str) -> dict:
    """Build the JSON input for turn 3: Elena has just answered the first question."""
    employee_turn = {
        "turn_no": 2,
        "speaker": "employee",
        "text": employee_text,
        "kind": None,
        "evidence": None,
    }
    return {
        "person_name": "Elena Ruiz",
        "role_title": "Senior Client Consultant",
        "topics": TOPICS,
        "day": "2026-09-18",
        "working_minutes": 480,
        "calendar_activities": CALENDAR_ACTIVITIES,
        "transcript_activities": TRANSCRIPT_ACTIVITIES,
        "turns_so_far": [FIRST_SCOUT_TURN, employee_turn],
    }


def _client():
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise SystemExit("Missing environment variable: ANTHROPIC_API_KEY")
    from anthropic import Anthropic

    return Anthropic(api_key=key)


def interview_turn(employee_text: str, system_prompt: str | None = None) -> str:
    """Take the employee's latest message and return Claude's raw text reply."""
    if system_prompt is None:
        system_prompt = load_system_prompt()
    # The anthropic package no longer names temperature in messages.create, so it goes
    # through extra_body. make.com sends the same value.
    message = _client().messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=system_prompt,
        messages=[{"role": "user", "content": json.dumps(build_input(employee_text), ensure_ascii=False)}],
        extra_body={"temperature": TEMPERATURE},
    )
    return "".join(block.text for block in message.content if getattr(block, "type", "") == "text")


if __name__ == "__main__":
    text = sys.argv[1] if len(sys.argv) > 1 else "I was fixing the status pack all morning."
    print(interview_turn(text))
