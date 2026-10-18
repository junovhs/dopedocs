import { defineDocs } from "dopedocs";

/** Public template: no customer answers. Replace every REPLACE value and review
 * date before publication. The sample dates confirm only the template shape.
 * Build with { entityType: "Plumber", articleType: "Article" }.
 * Disambiguate the trading name by locality and authoritative public profiles.
 */
export const docs = defineDocs({
    "entity": {
        "name": "REPLACE Plumbing",
        "url": "https://plumbing.example",
        "notToBeConfusedWith": [
            "REPLACE: similarly named businesses in other service areas"
        ],
        "schemaProperties": {
            "telephone": "REPLACE: public booking telephone",
            "address": {
                "@type": "PostalAddress",
                "streetAddress": "REPLACE: public business address",
                "addressLocality": "REPLACE: locality",
                "addressRegion": "REPLACE: region",
                "postalCode": "REPLACE: postcode",
                "addressCountry": "REPLACE: country"
            },
            "areaServed": "REPLACE: approved service area",
            "openingHours": "REPLACE: ordinary business hours"
        }
    },
    "title": "REPLACE Plumbing customer guide",
    "lead": "A placeholder-only question set for a plumbing business. Every answer needs business approval before publication.",
    "facts": {
        "service_area": {
            "value": "REPLACE: List towns, postcodes, travel limits and any excluded areas.",
            "reviewed": "2026-10-18"
        },
        "booking_method": {
            "value": "REPLACE: State the booking channels and information needed.",
            "reviewed": "2026-10-18"
        },
        "response_time": {
            "value": "REPLACE: State ordinary response expectations and what is not guaranteed.",
            "reviewed": "2026-10-18"
        },
        "emergency_hours": {
            "value": "REPLACE: State emergency coverage, hours and how to request it.",
            "reviewed": "2026-10-18"
        },
        "appointment_window": {
            "value": "REPLACE: State arrival windows and how delays are communicated.",
            "reviewed": "2026-10-18"
        },
        "cancellation": {
            "value": "REPLACE: State cancellation deadlines, fees and exceptions.",
            "reviewed": "2026-10-18"
        },
        "access": {
            "value": "REPLACE: State parking, keys, adult attendance and access requirements.",
            "reviewed": "2026-10-18"
        },
        "rescheduling": {
            "value": "REPLACE: State how and when appointments may be changed.",
            "reviewed": "2026-10-18"
        },
        "callout_fee": {
            "value": "REPLACE: State the fee, when it applies and whether it offsets later work.",
            "reviewed": "2026-10-18"
        },
        "diagnostic_fee": {
            "value": "REPLACE: State the diagnostic charge and what happens if work is declined.",
            "reviewed": "2026-10-18"
        },
        "quotes": {
            "value": "REPLACE: Explain quote validity, inclusions and how changes are approved.",
            "reviewed": "2026-10-18"
        },
        "after_hours_fee": {
            "value": "REPLACE: State any after-hours charge and when it applies.",
            "reviewed": "2026-10-18"
        },
        "payment_methods": {
            "value": "REPLACE: State accepted payment methods and payment timing.",
            "reviewed": "2026-10-18"
        },
        "deposit": {
            "value": "REPLACE: State deposit rules, refund terms and exceptions.",
            "reviewed": "2026-10-18"
        },
        "financing": {
            "value": "REPLACE: State whether financing exists and who supplies the terms.",
            "reviewed": "2026-10-18"
        },
        "tax": {
            "value": "REPLACE: State tax inclusion and how itemized invoices are provided.",
            "reviewed": "2026-10-18"
        },
        "licensing": {
            "value": "REPLACE: State jurisdiction, licence identifier and how customers can verify it.",
            "reviewed": "2026-10-18"
        },
        "insurance": {
            "value": "REPLACE: State relevant coverage and how to request evidence.",
            "reviewed": "2026-10-18"
        },
        "services": {
            "value": "REPLACE: List supported jobs and clear exclusions.",
            "reviewed": "2026-10-18"
        },
        "property_types": {
            "value": "REPLACE: State supported residential, rental and commercial property types.",
            "reviewed": "2026-10-18"
        },
        "permits": {
            "value": "REPLACE: State when permits may be needed and who is responsible.",
            "reviewed": "2026-10-18"
        },
        "parts": {
            "value": "REPLACE: State parts selection, customer approval and supplied-part limits.",
            "reviewed": "2026-10-18"
        },
        "preparation": {
            "value": "REPLACE: State safe preparation steps and tasks reserved for qualified people.",
            "reviewed": "2026-10-18"
        },
        "cleanup": {
            "value": "REPLACE: State cleanup and disposal inclusions and exclusions.",
            "reviewed": "2026-10-18"
        },
        "labour_warranty": {
            "value": "REPLACE: State labour coverage, duration, exclusions and claim process.",
            "reviewed": "2026-10-18"
        },
        "parts_warranty": {
            "value": "REPLACE: State manufacturer and supplier coverage separately from labour.",
            "reviewed": "2026-10-18"
        },
        "followup": {
            "value": "REPLACE: State contact route, triage, charges and coverage assessment.",
            "reviewed": "2026-10-18"
        },
        "complaints": {
            "value": "REPLACE: State complaints channel and expected response process.",
            "reviewed": "2026-10-18"
        },
        "records": {
            "value": "REPLACE: State what job records customers receive and how to request copies.",
            "reviewed": "2026-10-18"
        },
        "support_hours": {
            "value": "REPLACE: State ordinary support hours, time zone and emergency contact route.",
            "reviewed": "2026-10-18"
        }
    },
    "sections": [
        {
            "id": "booking",
            "title": "Booking and visits",
            "children": [
                {
                    "id": "service-area",
                    "title": "Service area",
                    "question": "Which areas does the plumbing business serve?",
                    "answer": "REPLACE Plumbing: {fact:service_area}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "booking-method",
                    "title": "Book a visit",
                    "question": "How do I book a plumbing visit?",
                    "answer": "REPLACE Plumbing: {fact:booking_method}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "response-time",
                    "title": "Response times",
                    "question": "How soon can a plumber attend?",
                    "answer": "REPLACE Plumbing: {fact:response_time}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "emergency-hours",
                    "title": "Emergency hours",
                    "question": "Is emergency plumbing available outside normal hours?",
                    "answer": "REPLACE Plumbing: {fact:emergency_hours}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "appointment-window",
                    "title": "Arrival windows",
                    "question": "When will the plumber arrive?",
                    "answer": "REPLACE Plumbing: {fact:appointment_window}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "cancellation",
                    "title": "Cancellation",
                    "question": "What happens if I cancel a plumbing visit?",
                    "answer": "REPLACE Plumbing: {fact:cancellation}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "access",
                    "title": "Access to the property",
                    "question": "What access does the plumber need?",
                    "answer": "REPLACE Plumbing: {fact:access}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "rescheduling",
                    "title": "Rescheduling",
                    "question": "Can I change my plumbing appointment?",
                    "answer": "REPLACE Plumbing: {fact:rescheduling}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                }
            ]
        },
        {
            "id": "costs",
            "title": "Costs and payment",
            "children": [
                {
                    "id": "callout-fee",
                    "title": "Call-out fee",
                    "question": "Is there a plumbing call-out fee?",
                    "answer": "REPLACE Plumbing: {fact:callout_fee}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "diagnostic-fee",
                    "title": "Declined diagnostics",
                    "question": "Who pays if I decline work after diagnosis?",
                    "answer": "REPLACE Plumbing: {fact:diagnostic_fee}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "quotes",
                    "title": "Quotes and estimates",
                    "question": "Is a plumbing quote fixed or an estimate?",
                    "answer": "REPLACE Plumbing: {fact:quotes}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "after-hours-fee",
                    "title": "After-hours charges",
                    "question": "Does emergency plumbing cost more?",
                    "answer": "REPLACE Plumbing: {fact:after_hours_fee}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "payment-methods",
                    "title": "Payment methods",
                    "question": "How can I pay for plumbing work?",
                    "answer": "REPLACE Plumbing: {fact:payment_methods}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "deposit",
                    "title": "Deposits",
                    "question": "Is a deposit required for plumbing work?",
                    "answer": "REPLACE Plumbing: {fact:deposit}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "financing",
                    "title": "Financing",
                    "question": "Is financing available for plumbing work?",
                    "answer": "REPLACE Plumbing: {fact:financing}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "tax",
                    "title": "Taxes and invoices",
                    "question": "Do plumbing prices include taxes?",
                    "answer": "REPLACE Plumbing: {fact:tax}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                }
            ]
        },
        {
            "id": "work",
            "title": "Work and qualifications",
            "children": [
                {
                    "id": "licensing",
                    "title": "Licensing",
                    "question": "Is the plumbing business licensed?",
                    "answer": "REPLACE Plumbing: {fact:licensing}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "insurance",
                    "title": "Insurance",
                    "question": "Is the plumbing business insured?",
                    "answer": "REPLACE Plumbing: {fact:insurance}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "services",
                    "title": "Available services",
                    "question": "What plumbing services are offered?",
                    "answer": "REPLACE Plumbing: {fact:services}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "property-types",
                    "title": "Property types",
                    "question": "Does the plumber work on commercial properties?",
                    "answer": "REPLACE Plumbing: {fact:property_types}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "permits",
                    "title": "Permits",
                    "question": "Who arranges permits for plumbing work?",
                    "answer": "REPLACE Plumbing: {fact:permits}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "parts",
                    "title": "Replacement parts",
                    "question": "Which replacement parts will the plumber use?",
                    "answer": "REPLACE Plumbing: {fact:parts}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "preparation",
                    "title": "Prepare for the visit",
                    "question": "What should I do before the plumber arrives?",
                    "answer": "REPLACE Plumbing: {fact:preparation}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "cleanup",
                    "title": "Cleanup",
                    "question": "Will the plumber remove waste after the job?",
                    "answer": "REPLACE Plumbing: {fact:cleanup}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                }
            ]
        },
        {
            "id": "aftercare",
            "title": "After the visit",
            "children": [
                {
                    "id": "labour-warranty",
                    "title": "Labour warranty",
                    "question": "What warranty applies to plumbing labour?",
                    "answer": "REPLACE Plumbing: {fact:labour_warranty}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "parts-warranty",
                    "title": "Parts warranty",
                    "question": "What warranty applies to replacement plumbing parts?",
                    "answer": "REPLACE Plumbing: {fact:parts_warranty}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "followup",
                    "title": "Follow-up faults",
                    "question": "What if the same plumbing problem returns?",
                    "answer": "REPLACE Plumbing: {fact:followup}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "complaints",
                    "title": "Complaints",
                    "question": "How do I raise a concern about plumbing work?",
                    "answer": "REPLACE Plumbing: {fact:complaints}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "records",
                    "title": "Work records",
                    "question": "Can I get records of the plumbing work?",
                    "answer": "REPLACE Plumbing: {fact:records}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                },
                {
                    "id": "support-hours",
                    "title": "Support hours",
                    "question": "When can I contact the plumbing business after a visit?",
                    "answer": "REPLACE Plumbing: {fact:support_hours}",
                    "blocks": [
                        {
                            "kind": "callout",
                            "tone": "warn",
                            "text": "Template only. Replace this placeholder with an approved, self-contained answer before publication."
                        }
                    ]
                }
            ]
        }
    ]
});

/** Pass these beside docs to your build integration. */
export const buildOptions = { entityType: "Plumber", articleType: "Article" };
