# Finanzas — Product context

## Surface

`Inversiones` is the operating surface for tracking a mixed portfolio of ETFs, crypto, staking and cold-wallet holdings inside the existing personal-finance app.

## Mode

Operate. The page should answer quickly:

1. What is the portfolio worth now?
2. Which numbers are live, fallback or incomplete?
3. What operation should be recorded next?

## Source of truth

The application ships an app-native initial portfolio snapshot dated 22 June
2026. On first use it is persisted to SQLite; every later operation and price
update uses the application database and configured market providers.

## Voice

Calm, precise and transparent in Spanish. The app records and explains financial data; it does not give investment advice or execute broker orders.

## Anti-references

- Purple gradients, glassmorphism and decorative card stacks.
- Status badges that hide whether a price is live, fallback or a last close.
- Copy that implies a purchase or sale was sent to a broker.
