# instagram-vocabulary MCP Server

Extracts English vocabulary words from Instagram reels/carousels and saves them to a Notion database.

## Tools

| Tool | Description |
|------|-------------|
| `process_instagram_vocabulary` | Download a reel/carousel → transcribe audio → OCR slides → extract vocabulary → save to Notion |
| `search_vocabulary` | Search your saved vocabulary bank by word, definition, synonym, or context |

## Setup

### 1. Copy env file and fill in keys

```bash
cp .env.example .env
```

| Variable | Where to get it |
|----------|----------------|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → API Keys |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `NOTION_API_KEY` | [notion.so/my-integrations](https://notion.so/my-integrations) → New integration |
| `NOTION_DATABASE_ID` | See step 2 below |

### 2. Create the Notion Database

In your Notion **Learning** page, create a new **Database** (inline or full-page) called **Vocabulary Bank** with these properties:

| Property name | Type |
|--------------|------|
| Word | Title |
| Part of Speech | Select |
| Definition | Text |
| Example Sentence | Text |
| Synonyms | Text |
| Context Notes | Text |
| Source URL | URL |
| Date Added | Date |

Then:
1. Open the database → click `...` → **Copy link**
2. The database ID is the 32-char string in the URL: `notion.so/<workspace>/<DATABASE_ID>?v=...`
3. Paste it as `NOTION_DATABASE_ID` in your `.env`
4. Share the database with your integration (click **Share** → search your integration name)

### 3. Run locally

```bash
pnpm dev
```

### 4. Deploy to Manufact

```bash
npx @mcp-use/cli login
npx @mcp-use/cli deploy
```

### 5. Connect to Perplexity

1. Go to [perplexity.ai/account/connectors](https://perplexity.ai/account/connectors)
2. Click **+ Custom Connector**
3. Paste your Manufact server URL (e.g. `https://instagram-vocabulary.manufact.app/mcp`)
4. Save and toggle it on from the Perplexity homepage under **Sources**

## Usage in Perplexity

```
Save vocab from this reel: https://www.instagram.com/reel/...
```

```
What words have I saved about business?
```

```
Search my vocabulary for words related to emotions
```
