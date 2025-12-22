# 🔗 Stripe Webhook Setup Guide

Il webhook Stripe è necessario per aggiornare automaticamente il piano utente su Firebase quando un pagamento viene completato.

---

## 🛠️ Setup per Development (Localhost)

Per testare i webhook in locale, devi usare **Stripe CLI**:

### 1. Installa Stripe CLI

**Windows:**
```bash
# Scarica da https://github.com/stripe/stripe-cli/releases/latest
# Oppure usa Scoop:
scoop install stripe
```

**macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

**Linux:**
```bash
# Scarica il binary da GitHub releases
```

### 2. Login a Stripe

```bash
stripe login
```

Questo aprirà il browser per autorizzare il CLI.

### 3. Forward Webhook Events

Apri un nuovo terminale e esegui:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### 4. Copia il Webhook Secret

Il comando sopra mostrerà un **webhook signing secret** (inizia con `whsec_...`).

Aggiungilo al tuo `.env.local`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 5. Riavvia il Server Next.js

```bash
npm run dev
```

### 6. Testa il Pagamento

1. Vai su `/dashboard/plan`
2. Seleziona un piano
3. Completa il checkout con carta di test: `4242 4242 4242 4242`
4. Il webhook verrà triggerato automaticamente
5. Firebase verrà aggiornato
6. Tornerai alla dashboard con il piano aggiornato!

---

## 🚀 Setup per Production

### 1. Deploy la tua App

Assicurati che la tua app sia deployata e raggiungibile (es. su Vercel, Netlify, ecc.).

### 2. Aggiungi Webhook Endpoint in Stripe

1. Vai su [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Clicca **"Add endpoint"**
3. **Endpoint URL**: `https://tuodominio.com/api/stripe/webhook`
4. **Eventi da ascoltare**:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Clicca **"Add endpoint"**

### 3. Copia il Signing Secret

1. Clicca sull'endpoint appena creato
2. Nella sezione **"Signing secret"**, clicca **"Reveal"**
3. Copia il secret (inizia con `whsec_...`)

### 4. Aggiungi alle Variabili d'Ambiente di Produzione

Nel tuo hosting provider (Vercel, Netlify, ecc.), aggiungi:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 5. Testa in Produzione

1. Fai un pagamento reale (o usa carte di test)
2. Stripe invierà automaticamente i webhook
3. La tua app aggiornerà Firebase
4. L'utente vedrà il piano aggiornato!

---

## 🧪 Test Webhook

### Test Manuale con Stripe CLI

```bash
# Trigger un evento di test
stripe trigger checkout.session.completed
```

### Verifica Webhook

1. Vai su [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Clicca sul tuo endpoint
3. Controlla la sezione **"Recent events"**
4. Ogni evento dovrebbe mostrare un **200 OK** response

---

## ❓ Troubleshooting

### Webhook non funziona in locale

- ✅ Verifica che `stripe listen` sia in esecuzione
- ✅ Controlla che `STRIPE_WEBHOOK_SECRET` sia nel `.env.local`
- ✅ Riavvia il server Next.js dopo aver aggiunto il secret

### Webhook non funziona in produzione

- ✅ Verifica che l'URL dell'endpoint sia corretto e HTTPS
- ✅ Controlla che `STRIPE_WEBHOOK_SECRET` sia nelle env vars di produzione
- ✅ Verifica i log del webhook in Stripe Dashboard

### Piano non si aggiorna

- ✅ Controlla i log del server Next.js
- ✅ Verifica che i metadata (`userId`, `plan`, `interval`) siano passati correttamente
- ✅ Controlla che Firebase abbia i permessi corretti

---

## 📊 Eventi Webhook Gestiti

Il nostro webhook gestisce questi eventi:

| Evento | Descrizione | Azione |
|--------|-------------|--------|
| `checkout.session.completed` | Pagamento completato | Aggiorna piano utente |
| `customer.subscription.updated` | Subscription modificata | Aggiorna piano utente |
| `customer.subscription.deleted` | Subscription cancellata | Downgrade a Free |

---

## 🔒 Sicurezza

- ✅ **Verifica firma**: Ogni webhook viene verificato con il signing secret
- ✅ **HTTPS obbligatorio**: In produzione, Stripe richiede HTTPS
- ✅ **Metadata validati**: Controlliamo sempre che userId, plan e interval siano presenti

---

## 💡 Nota Importante

In **development**, la dashboard ha anche un **polling mechanism** che controlla ogni secondo per 10 secondi se il piano è stato aggiornato. Questo serve come fallback se il webhook non è configurato, ma **non è raccomandato per produzione**.

Per produzione, **devi sempre configurare il webhook** per prestazioni ottimali e affidabilità.


