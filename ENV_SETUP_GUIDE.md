# 🔧 Environment Variables Setup Guide

## ⚠️ PROBLEMA ATTUALE

Il tuo `.env.local` manca delle variabili essenziali. Attualmente hai solo:
- ✅ `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`

Ma ti mancano:
- ❌ `STRIPE_SECRET_KEY`
- ❌ `STRIPE_PRICE_PRO_MONTHLY`
- ❌ `STRIPE_PRICE_PRO_YEARLY`
- ❌ `STRIPE_PRICE_ULTRA_MONTHLY`
- ❌ `STRIPE_PRICE_ULTRA_YEARLY`

---

## 📝 STEP 1: Copia questo template nel tuo .env.local

Apri il file `.env.local` nella root del progetto e assicurati che contenga **TUTTE** queste righe:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=xxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxxxxxxxxxxxx

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxx


# Stripe Price IDs - DEVI CREARLI (vedi sotto)
STRIPE_PRICE_PRO_MONTHLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_PRO_YEARLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_ULTRA_MONTHLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_ULTRA_YEARLY=price_xxxxxxxxxxxxx

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🔑 STEP 2: Ottieni STRIPE_SECRET_KEY

1. Vai su [Stripe Dashboard → API Keys](https://dashboard.stripe.com/test/apikeys)
2. Assicurati di essere in **Test Mode** (toggle in alto a destra)
3. Nella sezione "Standard keys" trovi:
   - **Publishable key** (inizia con `pk_test_`) → già ce l'hai
   - **Secret key** (inizia con `sk_test_`) → clicca "Reveal test key" e **COPIALO**
4. Incolla il Secret key nel `.env.local` alla riga `STRIPE_SECRET_KEY=sk_test_...`

---

## 💰 STEP 3: Crea i Prodotti e i Price IDs in Stripe

### Crea il Piano PRO

1. Vai su [Stripe Dashboard → Products](https://dashboard.stripe.com/test/products)
2. Clicca **"+ Add product"**
3. Compila:
   - **Name**: `Pro Plan`
   - **Description**: `For serious financial tracking`
   - **Pricing model**: `Standard pricing`
   - **Price**: `9.99`
   - **Currency**: `EUR`
   - **Billing period**: `Monthly`
4. Clicca **"Save product"**
5. **COPIA il Price ID** (sotto il prezzo, inizia con `price_...`)
6. Incollalo nel `.env.local` alla riga `STRIPE_PRICE_PRO_MONTHLY=price_...`

7. Nella stessa pagina del prodotto Pro, clicca **"+ Add another price"**
8. Compila:
   - **Price**: `99.99`
   - **Currency**: `EUR`
   - **Billing period**: `Yearly`
9. Clicca **"Save price"**
10. **COPIA il Price ID** del prezzo annuale
11. Incollalo nel `.env.local` alla riga `STRIPE_PRICE_PRO_YEARLY=price_...`

### Crea il Piano ULTRA

12. Torna su [Products](https://dashboard.stripe.com/test/products) e clicca **"+ Add product"**
13. Compila:
    - **Name**: `Ultra Plan`
    - **Description**: `Maximum features and flexibility`
    - **Pricing model**: `Standard pricing`
    - **Price**: `19.99`
    - **Currency**: `EUR`
    - **Billing period**: `Monthly`
14. Clicca **"Save product"**
15. **COPIA il Price ID**
16. Incollalo nel `.env.local` alla riga `STRIPE_PRICE_ULTRA_MONTHLY=price_...`

17. Nella stessa pagina, clicca **"+ Add another price"**
18. Compila:
    - **Price**: `209.99`
    - **Currency**: `EUR`
    - **Billing period**: `Yearly`
19. Clicca **"Save price"**
20. **COPIA il Price ID**
21. Incollalo nel `.env.local` alla riga `STRIPE_PRICE_ULTRA_YEARLY=price_...`

---

## ✅ STEP 4: Verifica il .env.local

Il tuo `.env.local` finale dovrebbe assomigliare a questo (con i tuoi valori reali):

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyD5TzXXZiGosG_K1w11BYZTz8xQiYVwlFE
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=fintrack-12345.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=fintrack-12345
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=fintrack-12345.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456

# Stripe
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE

# Price IDs (questi sono esempi, sostituisci con i tuoi Price IDs da Stripe Dashboard)
STRIPE_PRICE_PRO_MONTHLY=price_YOUR_PRO_MONTHLY_PRICE_ID
STRIPE_PRICE_PRO_YEARLY=price_YOUR_PRO_YEARLY_PRICE_ID
STRIPE_PRICE_ULTRA_MONTHLY=price_YOUR_ULTRA_MONTHLY_PRICE_ID
STRIPE_PRICE_ULTRA_YEARLY=price_YOUR_ULTRA_YEARLY_PRICE_ID

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🔄 STEP 5: RIAVVIA IL SERVER

**IMPORTANTE**: Next.js legge il `.env.local` solo all'avvio del server!

1. Nel terminale dove sta girando `npm run dev`, premi **Ctrl+C**
2. Aspetta che il server si fermi completamente
3. Riavvia con: `npm run dev`
4. Aspetta che compili

---

## 🧪 STEP 6: Testa che funzioni

1. Vai su `http://localhost:3000/api/stripe/prices/test`
2. Dovresti vedere:
   ```json
   {
     "message": "Environment variables check",
     "envVars": {
       "STRIPE_SECRET_KEY": "✅ Set",
       "NEXT_PUBLIC_STRIPE_PUBLIC_KEY": "✅ Set",
       "STRIPE_PRICE_PRO_MONTHLY": "price_...",
       "STRIPE_PRICE_PRO_YEARLY": "price_...",
       "STRIPE_PRICE_ULTRA_MONTHLY": "price_...",
       "STRIPE_PRICE_ULTRA_YEARLY": "price_..."
     }
   }
   ```

3. Vai su `http://localhost:3000` (homepage)
4. In basso a destra dovresti vedere il box di debug con i prezzi caricati da Stripe
5. Se tutto funziona, vedrai:
   - ✅ Prices loaded successfully!
   - Pro Monthly: €9.99
   - Pro Yearly: €99.99
   - Ultra Monthly: €19.99
   - Ultra Yearly: €209.99

---

## 📞 Troubleshooting

### Problema: Ancora "❌ Missing" dopo il riavvio
- Verifica che il file si chiami esattamente `.env.local` (non `.env.local.txt`)
- Controlla che non ci siano spazi prima o dopo il nome delle variabili
- Controlla che non ci siano virgolette attorno ai valori

### Problema: "Invalid API Key"
- Assicurati di essere in Test Mode in Stripe Dashboard
- Controlla di aver copiato la chiave completa (inizia con `sk_test_`)

### Problema: "Price not found"
- Verifica che i Price IDs siano corretti (iniziano con `price_`)
- Controlla di essere in Test Mode e di aver copiato i Price IDs dalla sezione Test

---

## 🎉 Una volta completato

Quando tutto funziona, i prezzi nella homepage e nella pagina `/dashboard/plan` si aggiorneranno automaticamente usando i valori reali da Stripe Dashboard!


