# Market data behind the demo corpus

The seeded listings in [`prisma/seed-data.ts`](../prisma/seed-data.ts) are
fictional properties, but their rents are not invented. Each is set within the
range that market actually charges, so a verification result means something
rather than being arithmetic on a made-up number.

Figures were checked in September 2026. They move; treat them as representative
rather than current.

| Market | Type | Seeded rent | Observed market range |
| --- | --- | --- | --- |
| Lisbon (central) | 2 bed | €1,650–2,100 / month | €1,800–3,500, median ≈ €1,900 |
| Lisbon (Belém) | 3 bed | €2,650 / month | above the 2-bed median, larger stock |
| London (Hackney) | 2 bed | £2,550 / month | average £2,644 (July 2026) |
| Dubai (JLT) | 3 bed | AED 185,000 / year | AED 170,000–230,000; citywide median 180,000 |
| Berlin (Prenzlauer Berg) | 2 bed | €1,720 / month | Kaltmiete, Nebenkosten billed separately |
| Austin (East) | 1 bed | $2,050 / month | converted-loft stock east of I-35 |
| Cape Town (Sea Point) | 2 bed | R26,500 / month | levy typically included |
| Singapore (Tiong Bahru) | 3 bed | S$6,200 / month | low-rise, walking distance to MRT |
| Toronto (Roncesvalles) | 1 bed | C$2,250 / month | heat and water usually included |
| Lagos (Lekki Phase 1) | 3 bed | ₦7,500,000 / year | payable annually in advance |

## Sources

- [idealista — Lisbon rentals](https://www.idealista.pt/en/arrendar-casas/lisboa/)
- [Spotahome — Lisbon rental guide 2026](https://www.spotahome.com/blog/lisbon-rental-guide-2026/)
- [Investropa — updated Lisbon rents](https://investropa.com/blogs/news/lisbon-rents)
- [ONS — housing prices, Hackney](https://www.ons.gov.uk/visualisations/housingpriceslocal/E09000012/)
- [Homefinders — renting in Hackney 2026](https://www.homefinders.net/renting-in-hackney-in-2026/)
- [dataHabibi — rent in Dubai 2026 by area](https://datahabibi.ae/blog/renting-in-dubai)
- [Sands of Wealth — updated Dubai rents](https://sandsofwealth.com/blogs/news/dubai-rents)

## What is deliberately not real

No listing here is copied from a portal. Scraping one would breach its terms,
and the photographs and addresses would belong to someone else.

Every contact number comes from a range a regulator reserves for fiction — the
Ofcom drama range, NANP 555-01xx, or the ACMA drama range — so no seeded
listing can put an automated call through to a real person. See
[`src/domain/phone.ts`](../src/domain/phone.ts).

Photography is from Unsplash and vendored into `public/img/`; it illustrates
the kind of property described and is not a photograph of it. See
[`public/img/CREDITS.md`](../public/img/CREDITS.md).
