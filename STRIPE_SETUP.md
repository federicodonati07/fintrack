# Stripe Setup Guide

## Step 1: Create Products in Stripe Dashboard

1. Vai su [Stripe Dashboard](https://dashboard.stripe.com/test/products)
2. Assicurati di essere in **Test Mode** (toggle in alto a destra)

## Step 2: Create Pro Plan

1. Clicca su **"+ Add product"**
2. Compila:
   - **Name**: Pro Plan
   - **Description**: For serious financial tracking
   - **Pricing**: Recurring
   - **Price**: €9.99
   - **Billing period**: Monthly
3. Clicca **"Add pricing"** per aggiungere il prezzo annuale:
   - **Price**: €99.99
   - **Billing period**: Yearly
4. Salva il prodotto
5. **Copia i Price IDs** (iniziano con `price_...`):
   - Price ID Monthly → `STRIPE_PRICE_PRO_MONTHLY`
   - Price ID Yearly → `STRIPE_PRICE_PRO_YEARLY`

## Step 3: Create Ultra Plan

1. Clicca su **"+ Add product"**
2. Compila:
   - **Name**: Ultra Plan
   - **Description**: Maximum features and flexibility
   - **Pricing**: Recurring
   - **Price**: €19.99
   - **Billing period**: Monthly
3. Clicca **"Add pricing"** per aggiungere il prezzo annuale:
   - **Price**: €209.99
   - **Billing period**: Yearly
4. Salva il prodotto
5. **Copia i Price IDs**:
   - Price ID Monthly → `STRIPE_PRICE_ULTRA_MONTHLY`
   - Price ID Yearly → `STRIPE_PRICE_ULTRA_YEARLY`

## Step 4: Add Price IDs to .env.local

Aggiungi questi valori al tuo file `.env.local`:

```env
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# Stripe Price IDs (sostituisci con i tuoi Price IDs da Stripe Dashboard)
STRIPE_PRICE_PRO_MONTHLY=price_YOUR_PRO_MONTHLY_PRICE_ID
STRIPE_PRICE_PRO_YEARLY=price_YOUR_PRO_YEARLY_PRICE_ID
STRIPE_PRICE_ULTRA_MONTHLY=price_YOUR_ULTRA_MONTHLY_PRICE_ID
STRIPE_PRICE_ULTRA_YEARLY=price_YOUR_ULTRA_YEARLY_PRICE_ID

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 5: Setup Webhook (per aggiornamento automatico piano)

### Opzione A: Development con Stripe CLI

1. Installa [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. Login: `stripe login`
3. Forward webhook: 
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
4. Copia il **webhook signing secret** (inizia con `whsec_...`)
5. Aggiungilo a `.env.local` come `STRIPE_WEBHOOK_SECRET`

### Opzione B: Production

1. Vai su [Stripe Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Clicca **"+ Add endpoint"**
3. URL endpoint: `https://tuodominio.com/api/stripe/webhook`
4. Eventi da ascoltare:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copia il **Signing secret** e aggiungilo a `.env.local`

## Step 6: Restart Server

Dopo aver aggiunto le variabili d'ambiente:

```bash
# Ferma il server
Ctrl+C

# Riavvia
npm run dev
```

## Verifica Configurazione

Controlla che tutte le variabili siano presenti:

```bash
# In .env.local dovrebbero esserci:
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_ULTRA_MONTHLY=price_...
STRIPE_PRICE_ULTRA_YEARLY=price_...
```

## Test Flow

1. Vai su `/dashboard/plan`
2. Seleziona un piano (Pro o Ultra)
3. Clicca "Upgrade"
4. Verifica che si apra Stripe Checkout
5. Usa una carta di test: `4242 4242 4242 4242`, CVC: `123`, Data: futuro
6. Completa il checkout
7. Torna su `/dashboard` e verifica che il piano sia aggiornato

## Carte di Test Stripe

- **Successo**: `4242 4242 4242 4242`
- **Autenticazione richiesta**: `4000 0025 0000 3155`
- **Fallimento**: `4000 0000 0000 9995`

Tutte con qualsiasi CVC e data futura.


