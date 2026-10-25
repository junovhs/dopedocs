// One typed document, rendered five ways. Mirrors dopedocs' defineDocs shape:
// chapters → sections, each section with a question, a short answer and blocks.
window.DOC = {
  entity: { name: "Halcyon Duo", kind: "Espresso machine", version: "v2.4" },
  title: "Halcyon Duo Manual",
  lead: "Everything you need to pull a great shot at home, keep the machine happy, and fix it when it sulks.",
  facts: {
    temp: "93 °C", pressure: "9 bar", tank: "2.1 L", warmup: "under 3 minutes",
    descale: "every 8 weeks", filter: "every 60 days", warranty: "2 years", weight: "11.4 kg",
  },
  chapters: [
    {
      id: "start", title: "Getting started", icon: "spark", blurb: "Unbox, prime and learn the controls.",
      sections: [
        {
          id: "unbox", title: "What's in the box", min: 2,
          question: "What comes with the Halcyon Duo?",
          answer: "The machine, two portafilter baskets, a tamper, a milk jug, a water filter and a cleaning disc.",
          blocks: [
            { kind: "p", text: "Lift the machine out by its base, never by the group head or the steam wand. Keep the foam inserts for a season — if you ever need a warranty swap, they are the safest way to ship it." },
            { kind: "h3", id: "unbox-parts", text: "Parts checklist" },
            { kind: "table", head: ["Part", "Qty", "Where it lives"], rows: [
              ["Portafilter, 58 mm", "1", "Top tray"], ["Single + double baskets", "2", "Top tray"],
              ["Steel tamper", "1", "Side pocket"], ["Milk jug, 350 ml", "1", "Inside the drip tray"],
              ["Water filter cartridge", "1", "Taped to the tank lid"], ["Blind cleaning disc", "1", "Accessory box"],
            ]},
            { kind: "h3", id: "unbox-place", text: "Choosing a spot" },
            { kind: "p", text: "Give it 10 cm of air on each side and a socket it does not share with a kettle. The Duo draws 1,650 W while heating." },
            { kind: "note", tone: "tip", title: "Level matters", text: "A tilted machine pulls tilted shots. Check the bubble on the drip-tray lip before your first fill." },
          ],
        },
        {
          id: "prime", title: "First fill and priming", min: 4,
          question: "How do I set up the Duo for the first time?",
          answer: "Fit the filter, fill the tank, switch on, and run two tanks of water through the group and wand before brewing.",
          blocks: [
            { kind: "steps", items: [
              "Soak the filter cartridge for five minutes, then push it onto the post inside the tank.",
              "Fill the tank to the **MAX** line ({fact:tank}) with cold, soft water.",
              "Press [[Power]]. The ring glows amber while heating and turns white when ready — {fact:warmup}.",
              "Hold [[Brew]] for three seconds to start the priming cycle. Let it run until the tank is half empty.",
              "Open the steam dial for twenty seconds, then close it.",
            ]},
            { kind: "note", tone: "warn", title: "Never prime dry", text: "Running the pump with an empty tank can damage the seals. The Duo stops itself after 8 seconds, but don't test it." },
            { kind: "h3", id: "prime-why", text: "Why two tanks?" },
            { kind: "p", text: "The factory test leaves a little food-safe glycol in the boiler. Two full tanks flush it completely. See [the descaling guide](#descale) for what this water should look like later in life." },
          ],
        },
        {
          id: "controls", title: "The controls", min: 3,
          question: "What do the buttons and dials on the Duo do?",
          answer: "Three buttons handle power, brewing and the menu; the dial sets grind time or temperature; the steam dial runs the wand.",
          blocks: [
            { kind: "table", head: ["Control", "Tap", "Hold 3 s"], rows: [
              ["[[Power]]", "On / standby", "Full off"], ["[[Brew]]", "Start / stop a shot", "Prime cycle"],
              ["[[Menu]]", "Cycle display", "Open settings"], ["Select dial", "Adjust value", "Reset to default"],
            ]},
            { kind: "h3", id: "controls-ring", text: "Reading the light ring" },
            { kind: "list", items: [
              "**White, steady** — ready to brew.", "**Amber, breathing** — heating.",
              "**Blue, sweeping** — steam boiler ready.", "**Red, blinking** — something needs you. See [error codes](#codes).",
            ]},
          ],
        },
        {
          id: "pair", title: "Pairing the app", min: 2,
          question: "How do I connect the Duo to the Halcyon app?",
          answer: "Hold Menu and Brew together for five seconds, then choose “Add machine” in the app.",
          blocks: [
            { kind: "p", text: "Pairing is optional — every feature works from the front panel. The app adds shot history, recipe sync and firmware updates." },
            { kind: "steps", items: [
              "Hold [[Menu]] + [[Brew]] until the ring pulses blue.",
              "Open the app and tap **Add machine**. Keep your phone within two metres.",
              "Confirm the four-digit code shown on the display.",
            ]},
          ],
        },
      ],
    },
    {
      id: "brew", title: "Brewing", icon: "cup", blurb: "Shots, grind, milk and recipes.",
      sections: [
        {
          id: "first-shot", title: "Your first shot", min: 5,
          question: "How do I pull a shot of espresso?",
          answer: "Dose 18 g, tamp level, lock in, press Brew, and aim for about 36 g in the cup in 25–30 seconds.",
          blocks: [
            { kind: "steps", items: [
              "Warm the portafilter by running a blank shot through it.",
              "Dose **18 g** of fresh coffee into the double basket.",
              "Tamp level with firm, even pressure. Polish with a quarter turn.",
              "Lock in and press [[Brew]] straight away — the group is at {fact:temp}.",
              "Stop at roughly **36 g** in the cup. The timer on the display helps.",
            ]},
            { kind: "h3", id: "shot-ratio", text: "The 1:2 ratio" },
            { kind: "p", text: "Twice as much liquid out as coffee in is a dependable starting point. Go shorter (1:1.5) for syrupy and intense, longer (1:2.5) for lighter and sweeter." },
            { kind: "note", tone: "info", title: "Pressure is fixed", text: "The pump delivers {fact:pressure} at the puck. You steer the shot with grind and dose, not with pressure." },
          ],
        },
        {
          id: "dial-in", title: "Dialing in the grind", min: 6,
          question: "How do I fix a shot that runs too fast or too slow?",
          answer: "Too fast and sour: grind finer. Too slow and bitter: grind coarser. Change one thing at a time.",
          blocks: [
            { kind: "table", head: ["You see", "It tastes", "Do this"], rows: [
              ["Under 20 s", "Sour, thin", "Grind finer by one step"], ["25–30 s", "Balanced", "Leave it alone"],
              ["Over 35 s", "Bitter, dry", "Grind coarser by one step"], ["Spurting", "Uneven", "Check your tamp and distribution"],
            ]},
            { kind: "h3", id: "dial-log", text: "Keep a shot log" },
            { kind: "p", text: "Write down dose, yield, time and one word about taste. Three shots of notes beats thirty shots of guessing. The app's history does this for you if you [paired it](#pair)." },
          ],
        },
        {
          id: "milk", title: "Steaming milk", min: 5,
          question: "How do I steam milk for a latte or flat white?",
          answer: "Purge the wand, sink the tip just below the surface to stretch, then lower it to spin until the jug is too hot to hold.",
          blocks: [
            { kind: "steps", items: [
              "Fill the jug to the bottom of the spout with cold milk.",
              "Purge the wand for two seconds into the drip tray.",
              "Tip just under the surface, steam fully open. Listen for a gentle paper-tearing sound.",
              "Once the jug is warm to the touch, sink the wand a little to roll the milk.",
              "Close the steam at around 60 °C. Wipe and purge the wand immediately.",
            ]},
            { kind: "note", tone: "tip", title: "Oat milk", text: "Barista-style oat milk stretches faster. Spend half as long at the surface." },
          ],
        },
        {
          id: "recipes", title: "Recipes", min: 3,
          question: "What drinks can I make on the Duo?",
          answer: "Every espresso drink: espresso, ristretto, lungo, americano, flat white, latte and cappuccino.",
          blocks: [
            { kind: "table", head: ["Drink", "Coffee", "Yield", "Milk"], rows: [
              ["Ristretto", "18 g", "27 g", "—"], ["Espresso", "18 g", "36 g", "—"], ["Lungo", "18 g", "54 g", "—"],
              ["Flat white", "18 g", "36 g", "120 ml, thin foam"], ["Cappuccino", "18 g", "36 g", "150 ml, deep foam"],
            ]},
          ],
        },
      ],
    },
    {
      id: "care", title: "Care", icon: "leaf", blurb: "Daily cleaning, descaling and filters.",
      sections: [
        {
          id: "daily", title: "Daily cleaning", min: 2,
          question: "What should I clean every day?",
          answer: "Rinse the basket, flush the group, purge and wipe the steam wand, and empty the drip tray.",
          blocks: [
            { kind: "list", items: ["Knock out the puck and rinse the basket.", "Flush the group for three seconds without the portafilter.", "Purge and wipe the steam wand after every drink.", "Empty the drip tray before it floats its red marker."] },
          ],
        },
        {
          id: "backflush", title: "Backflushing", min: 4,
          question: "How do I backflush the Duo?",
          answer: "Put the blind disc in the basket, add a little cleaner, and run five 10-second cycles. Then repeat with plain water.",
          blocks: [
            { kind: "steps", items: ["Fit the blind disc in the single basket.", "Add half a teaspoon of espresso machine cleaner.", "Lock in. Press [[Brew]] for 10 s, stop, wait 10 s. Do this five times.", "Rinse the basket and repeat with no cleaner."] },
            { kind: "note", tone: "info", title: "How often", text: "Weekly with cleaner if you make more than three drinks a day, otherwise every two weeks." },
          ],
        },
        {
          id: "descale", title: "Descaling", min: 15,
          question: "How often should I descale, and how?",
          answer: "Descale {fact:descale}, or when the display shows DESCALE. The guided cycle takes about 20 minutes.",
          blocks: [
            { kind: "h3", id: "descale-run", text: "Running the cycle" },
            { kind: "steps", items: ["Remove the water filter from the tank.", "Mix one sachet of descaler with 1 L of water in the tank.", "Hold [[Menu]], choose **Care → Descale**, and follow the prompts.", "Refill with clean water when asked. The rinse runs on its own."] },
            { kind: "h3", id: "descale-water", text: "Hard water" },
            { kind: "p", text: "If your kettle grows a crust, set **Water hardness** to 4 in settings. The Duo will remind you more often and you'll thank it later." },
          ],
        },
        {
          id: "filter", title: "Replacing the filter", min: 2,
          question: "When do I replace the water filter?",
          answer: "Replace the filter {fact:filter}. Soak the new one for five minutes before fitting.",
          blocks: [
            { kind: "p", text: "Turn the date dial on the cartridge to the current month so you know when it's due. After fitting, hold [[Menu]] and choose **Care → Filter reset**." },
          ],
        },
      ],
    },
    {
      id: "fix", title: "Troubleshooting", icon: "wrench", blurb: "Error codes and common problems.",
      sections: [
        {
          id: "codes", title: "Error codes", min: 3,
          question: "What does the error code on my display mean?",
          answer: "Each code points to one part: E1 is water, E2 is temperature, E3 is the pump, E4 is the steam boiler.",
          blocks: [
            { kind: "table", head: ["Code", "Meaning", "What to do"], rows: [
              ["E1", "Tank empty or not seated", "Refill and push the tank down until it clicks."],
              ["E2", "Brew temperature out of range", "Switch off for 10 minutes, then restart."],
              ["E3", "Pump can't build pressure", "Grind coarser; check the basket isn't blocked."],
              ["E4", "Steam boiler fault", "Descale. If it returns, contact support."],
              ["DESCALE", "Scale reminder", "Run the [descale cycle](#descale)."],
            ]},
          ],
        },
        {
          id: "no-steam", title: "Weak or no steam", min: 3,
          question: "Why is there no steam coming from the wand?",
          answer: "Usually a blocked tip. Soak the tip in hot water and clear the holes with the pin under the drip tray.",
          blocks: [
            { kind: "steps", items: ["Wait for the blue ring — the steam boiler needs 40 seconds after a shot.", "Unscrew the wand tip and soak it in hot water for ten minutes.", "Clear each hole with the cleaning pin.", "Still weak? Descale; scale collects first in the steam path."] },
          ],
        },
        {
          id: "leaks", title: "Water under the machine", min: 2,
          question: "Why is my Duo leaking water?",
          answer: "Most leaks are an overfull drip tray or a tank that isn't seated. A leak from the group head means a worn gasket.",
          blocks: [
            { kind: "p", text: "Dry the counter, re-seat the tank and empty the tray. If water still appears around the group while brewing, the gasket is due — it's a ten-minute job with the kit from support." },
          ],
        },
      ],
    },
    {
      id: "ref", title: "Reference", icon: "book", blurb: "Specs, settings and the Connect API.",
      sections: [
        {
          id: "specs", title: "Specifications", min: 1,
          question: "What are the Halcyon Duo's specifications?",
          answer: "{fact:pressure} pump, PID brew boiler at {fact:temp}, separate steam boiler, {fact:tank} tank, {fact:weight}.",
          blocks: [
            { kind: "table", head: ["Spec", "Value"], rows: [
              ["Brew pressure", "{fact:pressure}"], ["Brew temperature", "{fact:temp}, PID ±0.5 °C"], ["Water tank", "{fact:tank}, removable"],
              ["Boilers", "Dual, 450 ml brew + 900 ml steam"], ["Power", "1,650 W, 220–240 V"], ["Weight", "{fact:weight}"],
            ]},
          ],
        },
        {
          id: "settings", title: "Settings menu", min: 3,
          question: "What can I change in the settings menu?",
          answer: "Brew temperature, shot volumes, water hardness, auto-off, display brightness and units.",
          blocks: [
            { kind: "h3", id: "settings-brew", text: "Brew" },
            { kind: "list", items: ["**Temperature** — 88 to 96 °C in 0.5° steps.", "**Pre-infusion** — off, 2 s, 4 s or 6 s.", "**Shot volume** — learn by holding [[Brew]] during a shot."] },
            { kind: "h3", id: "settings-machine", text: "Machine" },
            { kind: "list", items: ["**Water hardness** — 1 (soft) to 4 (hard).", "**Auto-off** — 20 min to 4 h.", "**Units** — metric or imperial."] },
          ],
        },
        {
          id: "api", title: "Connect API", min: 4,
          question: "Can I control the Duo from my own code?",
          answer: "Yes. On your local network the Duo exposes a small HTTP API once you enable it in the app.",
          blocks: [
            { kind: "p", text: "Turn on **Developer mode** in the app's machine settings. The Duo then answers on port 8080." },
            { kind: "code", lang: "bash", text: "curl http://halcyon.local:8080/v1/status\n# {\"state\":\"ready\",\"brewTemp\":93.0,\"steam\":true}" },
            { kind: "code", lang: "js", text: "await fetch(\"http://halcyon.local:8080/v1/brew\", {\n  method: \"POST\",\n  body: JSON.stringify({ recipe: \"flat-white\" }),\n});" },
            { kind: "note", tone: "warn", title: "Local only", text: "The API never leaves your network and has no cloud relay. Don't port-forward it." },
          ],
        },
        {
          id: "warranty", title: "Warranty and safety", min: 2,
          question: "What does the warranty cover?",
          answer: "{fact:warranty} on parts and labour, covering manufacturing faults but not scale damage.",
          blocks: [
            { kind: "p", text: "Keep your receipt. Scale damage isn't covered, which is the best argument for [descaling on time](#descale)." },
            { kind: "note", tone: "warn", title: "Hot surfaces", text: "The group head and steam wand stay hot for 20 minutes after use." },
          ],
        },
      ],
    },
  ],
};

// The Connect API, described as data. Code samples are generated from it.
window.DOC.api = {
  base: "http://halcyon.local:8080/v1",
  intro: "The Connect API lets your own code read the Duo's state and brew on it. It's plain HTTP and JSON, it lives on your local network, and every request is answered by the machine itself — there is no cloud in between.",
  auth: "Create a token in the app under **Machine → Developer mode**. Send it on every request in the `Authorization` header. Tokens never expire; revoke one from the same screen.",
  groups: [
    { id: "machine", title: "Machine", endpoints: [
      { id: "get-status", method: "GET", path: "/status", title: "Get status", guide: "controls",
        desc: "Returns what the machine is doing right now: heating, ready, brewing or showing an error. Poll it at most once a second.",
        params: [],
        response: { state: "ready", brewTemp: 93.0, steamReady: true, tankLevel: 0.72, error: null, firmware: "2.4.1" } },
      { id: "set-power", method: "POST", path: "/power", title: "Change power state", guide: "controls",
        desc: "Wakes the machine from standby or puts it to sleep. Waking starts the warm-up, which takes under 3 minutes.",
        params: [{ name: "state", type: "string", req: true, desc: "One of `on`, `standby` or `off`." }],
        response: { state: "heating", readyIn: 164 } },
    ]},
    { id: "brewing", title: "Brewing", endpoints: [
      { id: "start-brew", method: "POST", path: "/brew", title: "Start a shot", guide: "first-shot",
        desc: "Starts a shot with a saved recipe or with explicit values. The machine must be `ready` and have a portafilter locked in.",
        params: [
          { name: "recipe", type: "string", desc: "A saved recipe id such as `flat-white`. Overrides nothing you pass explicitly." },
          { name: "dose", type: "number", desc: "Coffee in the basket, in grams. Used to log the ratio." },
          { name: "yield", type: "number", desc: "Stop when this many grams are in the cup. Needs the scale accessory." },
          { name: "temperature", type: "number", desc: "Brew temperature, 88 to 96 °C." },
          { name: "preinfusion", type: "integer", desc: "Seconds of low-pressure soak: 0, 2, 4 or 6." },
        ],
        response: { id: "shot_8f2a", state: "brewing", startedAt: "2026-10-25T08:14:03Z", target: { yield: 36, temperature: 93 } } },
      { id: "stop-brew", method: "DELETE", path: "/brew", title: "Stop the current shot", guide: "first-shot",
        desc: "Stops the shot in progress, the same as pressing Brew. Safe to call when nothing is brewing.",
        params: [],
        response: { id: "shot_8f2a", state: "stopped", seconds: 27.4, yield: 35.8 } },
    ]},
    { id: "shots", title: "Shots", endpoints: [
      { id: "list-shots", method: "GET", path: "/shots", title: "List shots", guide: "dial-in",
        desc: "Returns recent shots, newest first. Useful for a dial-in log: time, yield and temperature for every pull.",
        params: [
          { name: "limit", type: "integer", desc: "How many to return, 1 to 100. Default 20." },
          { name: "since", type: "string", desc: "Only shots after this ISO 8601 time." },
        ],
        response: { data: [{ id: "shot_8f2a", seconds: 27.4, dose: 18, yield: 35.8, temperature: 93 }, { id: "shot_8f29", seconds: 21.1, dose: 18, yield: 38.2, temperature: 93 }], hasMore: true } },
      { id: "get-shot", method: "GET", path: "/shots/{id}", title: "Get a shot", guide: "dial-in",
        desc: "Returns one shot with its full pressure and flow curve, sampled ten times a second.",
        params: [{ name: "id", type: "string", req: true, in: "path", desc: "The shot id, like `shot_8f2a`." }],
        response: { id: "shot_8f2a", seconds: 27.4, curve: { pressure: [0, 2.1, 8.7, 9.0, 9.0], flow: [0, 0.4, 1.6, 1.9, 1.8] } } },
    ]},
    { id: "settings", title: "Settings", endpoints: [
      { id: "update-settings", method: "PATCH", path: "/settings", title: "Update settings", guide: "settings",
        desc: "Changes one or more settings. Anything you leave out stays as it is. Returns the full settings object.",
        params: [
          { name: "brewTemp", type: "number", desc: "88 to 96 °C in 0.5° steps." },
          { name: "waterHardness", type: "integer", desc: "1 (soft) to 4 (hard). Changes the descale reminder." },
          { name: "autoOff", type: "integer", desc: "Minutes until standby, 20 to 240." },
        ],
        response: { brewTemp: 93.5, waterHardness: 3, autoOff: 60, units: "metric" } },
    ]},
    { id: "care", title: "Care", endpoints: [
      { id: "start-descale", method: "POST", path: "/care/descale", title: "Start descaling", guide: "descale",
        desc: "Starts the guided descale. The machine asks for the descaler and the rinse water on its own display; this call only begins the cycle.",
        params: [],
        response: { state: "descaling", step: "add-solution", minutesLeft: 21 } },
    ]},
  ],
  errors: [
    { code: 400, name: "invalid_request", desc: "A parameter is missing or out of range. The message names it." },
    { code: 401, name: "unauthorized", desc: "No token, or the token was revoked." },
    { code: 409, name: "machine_busy", desc: "The machine is already brewing, steaming or descaling." },
    { code: 423, name: "not_ready", desc: "Still heating. Retry after `readyIn` seconds." },
    { code: 503, name: "machine_fault", desc: "The machine shows an error code; see `error` in the status." },
  ],
};
