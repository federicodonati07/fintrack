# Firebase Setup Guide

## Problema: "Impossibile raggiungere la pagina" durante il login Google

Se stai riscontrando l'errore con l'URL `https://localhost/__/auth/handler`, segui questi passaggi:

## 1. Configurare Domini Autorizzati in Firebase Console

1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Seleziona il tuo progetto
3. Vai su **Authentication** > **Settings** > **Authorized domains**
4. Assicurati che i seguenti domini siano presenti:
   - `localhost`
   - `127.0.0.1`
   - `localhost:3000` (se necessario, aggiungi anche questo)
   - Il tuo dominio di produzione (quando lo avrai)

**IMPORTANTE**: 
- `localhost` deve essere nella lista
- Non serve aggiungere la porta `:3000` se hai già `localhost`, ma non fa male aggiungerla
- I domini devono essere aggiunti **senza** `http://` o `https://`

## 2. Verificare OAuth Redirect URIs in Google Cloud Console

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Seleziona il progetto associato a Firebase
3. Vai su **APIs & Services** > **Credentials**
4. Clicca sul tuo **OAuth 2.0 Client ID** usato per Firebase
5. In **Authorized redirect URIs**, assicurati che ci siano:
   - `http://localhost:3000/__/auth/handler`
   - `http://localhost/__/auth/handler`
   - `https://[YOUR-PROJECT-ID].firebaseapp.com/__/auth/handler`

## 3. Verificare le Variabili d'Ambiente

Nel file `.env.local`, verifica che `authDomain` sia corretto:

```env
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
```

**NON** usare `localhost` come `authDomain`, deve essere `[project-id].firebaseapp.com`

## 4. Testare il Login

Dopo aver configurato tutto:

1. Riavvia il server di sviluppo: `npm run dev`
2. Apri `http://localhost:3000/auth`
3. Clicca su "Continue with Google"
4. Il popup dovrebbe aprirsi correttamente

## Risoluzione Problemi Comuni

### Errore: "auth/unauthorized-domain"
- Verifica che `localhost` sia nella lista dei domini autorizzati in Firebase Console
- Assicurati di usare `http://localhost:3000` e non `https://`

### Errore: "auth/popup-blocked"
- Abilita i popup nel browser
- Prova a usare una finestra privata

### Errore: "Impossibile raggiungere la pagina" con `https://localhost`
- Verifica che i domini autorizzati in Firebase Console includano `localhost`
- Verifica che l'`authDomain` nel `.env.local` sia `[project-id].firebaseapp.com`
- Riavvia il server di sviluppo dopo le modifiche

## Note

- Con `signInWithPopup`, Firebase gestisce automaticamente il redirect verso `/__/auth/handler`
- Non è necessario creare manualmente una route per `/__/auth/handler`
- Il problema è sempre nella configurazione di Firebase Console, non nel codice




