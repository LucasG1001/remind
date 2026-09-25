import { pool } from "./connection.js";

export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reminders (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title             TEXT NOT NULL,
      notes             TEXT,
      event_at          TIMESTAMPTZ NOT NULL,
      is_all_day        BOOLEAN NOT NULL DEFAULT false,
      recur_interval    INTEGER,
      recur_unit        TEXT,
      recur_weekday     SMALLINT,
      recur_mode        TEXT NOT NULL DEFAULT 'fixed',
      recur_anchor_at   TIMESTAMPTZ,
      status            TEXT NOT NULL DEFAULT 'active',
      phase             TEXT NOT NULL DEFAULT 'pending',
      next_notify_at    TIMESTAMPTZ,
      notify_count      INTEGER NOT NULL DEFAULT 0,
      max_notify        INTEGER NOT NULL DEFAULT 10,
      acknowledged      BOOLEAN NOT NULL DEFAULT false,
      acknowledged_at   TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Recorrência: modo (fixo/relativo) e âncora da série, separada do event_at da ocorrência.
  await pool.query(`
    ALTER TABLE reminders ADD COLUMN IF NOT EXISTS recur_mode TEXT NOT NULL DEFAULT 'fixed';
  `);

  await pool.query(`
    ALTER TABLE reminders ADD COLUMN IF NOT EXISTS recur_anchor_at TIMESTAMPTZ;
  `);

  // Backfill: linhas recorrentes legadas ancoram na ocorrência atual.
  await pool.query(`
    UPDATE reminders SET recur_anchor_at = event_at
      WHERE recur_anchor_at IS NULL AND recur_interval IS NOT NULL;
  `);

  // Consulta quente do scheduler: lembretes ativos com disparo vencido.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS reminders_due_idx
      ON reminders (next_notify_at)
      WHERE status = 'active';
  `);

  await pool.query(`
    ALTER TABLE reminders DROP COLUMN IF EXISTS last_message_id;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS habits (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name            TEXT NOT NULL,
      selected_days   INTEGER[] NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE habits ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'target';
  `);

  await pool.query(`
    ALTER TABLE habits ALTER COLUMN icon SET DEFAULT 'target';
  `);

  // Ordem manual dos hábitos (drag-and-drop). Coluna idempotente.
  await pool.query(`
    ALTER TABLE habits ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
  `);

  // Backfill só quando ainda não há ordenação (todas as posições iguais): roda 1x.
  await pool.query(`
    UPDATE habits h SET position = s.rn
    FROM (SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at) - 1) AS rn FROM habits) s
    WHERE h.id = s.id AND (SELECT COUNT(DISTINCT position) FROM habits) <= 1;
  `);

  await pool.query(`
    ALTER TABLE habits ADD COLUMN IF NOT EXISTS target_count INTEGER NOT NULL DEFAULT 1;
  `);

  await pool.query(`
    ALTER TABLE habits ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS habit_completions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      habit_id    UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      date        TEXT NOT NULL,
      locked      BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE(habit_id, date)
    );
  `);

  await pool.query(`
    ALTER TABLE habit_completions ADD COLUMN IF NOT EXISTS count INTEGER NOT NULL DEFAULT 0;
  `);

  // Enquanto a coluna legada `completed` existir: preserva o dado no `count` e some.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'habit_completions' AND column_name = 'completed'
      ) THEN
        UPDATE habit_completions SET count = 1 WHERE completed = TRUE AND count = 0;
        ALTER TABLE habit_completions DROP COLUMN completed;
      END IF;
    END $$;
  `);

  // Horários de aviso do hábito. Sem coluna de posição: a ordem é o `time`, e o
  // índice do horário nessa ordem é a chave que decide se ele já foi cumprido.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS habit_reminders (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      habit_id   UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      time       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(habit_id, time)
    );
  `);

  // Estado do dia, criado sob demanda: ausência de linha É o estado limpo, então
  // não existe rotina de reset em lugar nenhum (nem corrida na virada do dia).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS habit_reminder_runtime (
      habit_reminder_id UUID NOT NULL REFERENCES habit_reminders(id) ON DELETE CASCADE,
      date              TEXT NOT NULL,
      skipped           BOOLEAN NOT NULL DEFAULT FALSE,
      last_sent_at      TIMESTAMPTZ,
      PRIMARY KEY (habit_reminder_id, date)
    );
  `);

  await pool.query(`
    DELETE FROM habit_reminder_runtime
     WHERE date < to_char((NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '7 days', 'YYYY-MM-DD');
  `);

  await pool.query(`ALTER TABLE habits DROP COLUMN IF EXISTS current_streak`);
  await pool.query(`ALTER TABLE habits DROP COLUMN IF EXISTS longest_streak`);
  await pool.query(`ALTER TABLE habits DROP COLUMN IF EXISTS level`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS board_lists (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS board_lists_project_idx ON board_lists (project_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cards (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      list_id     UUID NOT NULL REFERENCES board_lists(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      done        BOOLEAN NOT NULL DEFAULT FALSE,
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS cards_list_idx ON cards (list_id);
  `);

  await pool.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}'`);
  await pool.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS checklist TEXT NOT NULL DEFAULT '[]'`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_tags (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      color       TEXT NOT NULL,
      icon        TEXT NOT NULL DEFAULT 'target',
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS project_tags_project_idx ON project_tags (project_id);
  `);

  // Vínculo N:N cartão/tag. As duas FKs cascateiam: é o que faz excluir uma tag
  // (ou um cartão) limpar o vínculo em todos os cartões sem código de limpeza.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS card_tags (
      card_id  UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      tag_id   UUID NOT NULL REFERENCES project_tags(id) ON DELETE CASCADE,
      PRIMARY KEY (card_id, tag_id)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS card_tags_tag_idx ON card_tags (tag_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS flashcard_categories (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      color       TEXT NOT NULL,
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS flashcards (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      question          TEXT NOT NULL,
      answer            TEXT NOT NULL,
      category_id       UUID REFERENCES flashcard_categories(id) ON DELETE SET NULL,
      box               INTEGER NOT NULL DEFAULT 1,
      next_review_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_reviewed_at  TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Sistema de Leitner + categorias: colunas novas para DBs que ainda têm o schema SM-2.
  await pool.query(`
    ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES flashcard_categories(id) ON DELETE SET NULL;
  `);
  await pool.query(`
    ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS box INTEGER NOT NULL DEFAULT 1;
  `);

  // Backfill 1x: enquanto a coluna legada `tag` existir, distintas viram categorias
  // (cor rotacionada da paleta) e os cards são religados; depois a coluna some.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'flashcards' AND column_name = 'tag'
      ) THEN
        INSERT INTO flashcard_categories (name, color, position)
        SELECT t.tag,
               (ARRAY['#b7aefc','#6ee7a8','#ff9b8a','#8fc5ff','#f0c878'])[(t.rn % 5) + 1],
               t.rn
        FROM (
          SELECT DISTINCT tag, (ROW_NUMBER() OVER (ORDER BY tag) - 1)::int AS rn
          FROM flashcards
          WHERE tag IS NOT NULL AND tag <> ''
        ) t
        WHERE NOT EXISTS (SELECT 1 FROM flashcard_categories c WHERE c.name = t.tag);

        UPDATE flashcards f
        SET category_id = c.id
        FROM flashcard_categories c
        WHERE f.category_id IS NULL AND f.tag IS NOT NULL AND f.tag = c.name;

        ALTER TABLE flashcards DROP COLUMN tag;
      END IF;
    END $$;
  `);

  // Remove o estado do SM-2 (substituído pelo Leitner via coluna `box`).
  await pool.query(`ALTER TABLE flashcards DROP COLUMN IF EXISTS ease_factor`);
  await pool.query(`ALTER TABLE flashcards DROP COLUMN IF EXISTS interval_days`);
  await pool.query(`ALTER TABLE flashcards DROP COLUMN IF EXISTS repetitions`);
  await pool.query(`ALTER TABLE flashcards DROP COLUMN IF EXISTS lapses`);

  // Imagens de flashcard (data URLs base64) foram removidas do produto.
  await pool.query(`ALTER TABLE flashcards DROP COLUMN IF EXISTS question_images`);
  await pool.query(`ALTER TABLE flashcards DROP COLUMN IF EXISTS answer_images`);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS flashcards_due_idx ON flashcards (next_review_at);
  `);

  // Web Push: uma linha por aparelho/browser inscrito. O endpoint é a identidade
  // natural da subscription, então serve de chave para o upsert.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      endpoint      TEXT NOT NULL UNIQUE,
      p256dh        TEXT NOT NULL,
      auth          TEXT NOT NULL,
      user_agent    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
