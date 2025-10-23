# AI Recommendations Setup Guide

The AI Recommendations feature supports two providers. Choose the one that works best for you:

## Option 1: Groq (RECOMMENDED) ✅

**Advantages:**
- ✅ Truly free, no credit card required
- ✅ Very fast inference (fastest in the industry)
- ✅ No payment method needed
- ✅ Generous free tier limits
- ✅ Great quality with Llama 3.3 70B (upgraded from 3.1)

**Setup:**

1. Go to https://console.groq.com
2. Sign up with your email (no credit card required)
3. Navigate to "API Keys" section
4. Click "Create API Key"
5. Copy the key
6. Add to your `.env` file:
   ```env
   GROQ_API_KEY=gsk_your_api_key_here
   ```
7. Restart your Docker container:
   ```bash
   docker-compose -f docker-compose.dev.yml restart app
   ```

**Models Used:**
- `llama-3.3-70b-versatile` - Excellent for recommendations (upgraded from 3.1)

---

## Option 2: OpenAI

**Advantages:**
- ✅ Very high quality
- ✅ Free tier with unlimited gpt-4o-mini access

**Disadvantages:**
- ⚠️ Requires payment method to be added (even for free tier)
- ⚠️ Won't charge you for free tier usage, but credit card must be on file

**Setup:**

1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Go to "Billing" → Add payment method (required even for free tier)
4. Navigate to "API Keys"
5. Click "Create new secret key"
6. Copy the key (starts with `sk-`)
7. Add to your `.env` file:
   ```env
   OPENAI_API_KEY=sk-your_api_key_here
   ```
8. Restart your Docker container:
   ```bash
   docker-compose -f docker-compose.dev.yml restart app
   ```

**Models Used:**
- `gpt-4o-mini` - Free tier unlimited access

---

## Priority

If both `GROQ_API_KEY` and `OPENAI_API_KEY` are set, **Groq will be used by default**.

To switch to OpenAI, simply remove or comment out the `GROQ_API_KEY` line in your `.env` file.

---

## Troubleshooting

### "429 Quota Exceeded" with OpenAI

This means you need to add a payment method to your OpenAI account:
1. Go to https://platform.openai.com/settings/organization/billing
2. Add a credit/debit card
3. The free tier won't charge you, but the card must be on file

**Solution:** Use Groq instead - no payment method required!

### "API key not configured"

Make sure you have either `GROQ_API_KEY` or `OPENAI_API_KEY` in your `.env` file and the Docker container has been restarted.

### Recommendations not generating

Check the Docker logs:
```bash
docker-compose -f docker-compose.dev.yml logs app | grep -i "groq\|openai\|ai"
```

You should see which provider is being used and any error messages.

---

## Costs

| Provider | Free Tier | Credit Card Required | Model |
|----------|-----------|---------------------|-------|
| **Groq** | 7,000 requests/day | ❌ No | llama-3.3-70b-versatile |
| **OpenAI** | Unlimited gpt-4o-mini | ⚠️ Yes (but won't charge) | gpt-4o-mini |

Both are effectively free for personal use!

