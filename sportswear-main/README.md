# PostgreSQL pg_trgm Extension Setup

## Overview

This project uses the [`pg_trgm`](https://www.postgresql.org/docs/current/pgtrgm.html) extension to enable similarity search using trigram-based matching in PostgreSQL.

The extension allows efficient fuzzy string matching via operators such as:
- `%` (similarity)
- `<->` (distance)
- and the `similarity()` function

These are useful in full-text search or when comparing addresses, names, etc.

---

## Enabling the Extension

To enable `pg_trgm` in your database, run the following SQL command:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
