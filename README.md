# TaskFlow — To-Do List

A clean, responsive, zero-dependency To-Do List web application built with HTML, CSS, and vanilla JavaScript, connected to **Supabase** for authentication and cloud persistence.

## Features

- **Supabase Sync & Auth**: Sign up or sign in with email/password to sync tasks privately across devices (`public.tasks` protected by Row Level Security).
- **Automatic Local Fallback**: Works immediately in guest mode using `localStorage`, and automatically migrates guest tasks into your Supabase account on sign-in.
- **Task Management**: Add, edit, complete, delete (with Undo), and drag-and-drop reorder tasks.
- **Organization**: Priorities (`High`, `Medium`, `Low`), due dates (with Today/Overdue indicators), categories, and notes.
- **Search & Filters**: Filter by status (`All`, `Active`, `Today & Overdue`, `Completed`), priority, category, and live text search.
- **Progress Tracking**: Real-time summary stats and completion progress bar.
- **Light & Dark Themes**: Automatic system theme detection with manual toggle.
- **Backup**: JSON export and import.
- **Keyboard Shortcuts**: Press `N` to add a new task, `/` to search, and `Esc` to close modals.

## Database Setup

The connected Supabase project (`taskflow-todo`) includes the `public.tasks` table with Row Level Security policies (`tasks_select_own`, `tasks_insert_own`, `tasks_update_own`, `tasks_delete_own`) scoped to `authenticated` users where `(select auth.uid()) = user_id`.

Client configuration lives in `supabase-config.js` using the public project URL and publishable key (`sb_publishable_...`).

## Getting Started

Serve the folder locally (recommended for Supabase Auth redirects):

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.
