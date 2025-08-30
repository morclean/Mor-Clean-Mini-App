// src/lib/checklist.js
// MOR Clean • Master, exhaustive, room-by-room checklist.
// Each array item is a single checkbox in the app.

export const MASTER_CHECKLIST = {
  "Arrival / Safety": [
    "Park legally; avoid blocking driveways/walkways",
    "Announce arrival if occupied; respect quiet hours",
    "Disarm alarm (per notes) or notify lead if issue",
    "Verify pets are secured per client notes",
    "Put on gloves/PPE as needed",
    "Scan for hazards (broken glass, needles, spills)",
    "Open blinds/curtains for light where appropriate",
    "Turn on ventilation/fans if using strong products",
  ],

  "General — All Areas": [
    "Collect misplaced dishes/trash from all rooms",
    "Pick up clutter; stage per property photos",
    "High dust (ceiling corners, vents, cobwebs)",
    "Dust light fixtures & lamp shades",
    "Dust ceiling fans (hold below to catch debris)",
    "Spot-clean walls, switch plates, door frames",
    "Wipe interior doors & handles",
    "Dust baseboards, trim & window sills",
    "Clean interior windows & mirrors (streak-free)",
    "Vacuum upholstery (under cushions if needed)",
    "Wipe tables, dressers, shelves, decor",
    "Disinfect high-touch points (remotes, handles)",
    "Empty all interior trash; replace liners",
    "Vacuum all carpets & rugs (edges if time)",
    "Sweep hard floors (under/behind furniture edges)",
    "Mop hard floors (correct cleaner for surface)",
    "Check lights; replace dead bulbs if provided",
  ],

  "Entry / Hallways": [
    "Shake/clean entry mat",
    "Wipe door glass & sidelights (inside)",
    "Clean door hardware & lock keypad",
    "Organize shoes/coats per staging",
  ],

  "Kitchen": [
    "Load/hand-wash dishes; run dishwasher if full",
    "Put away clean dishes (if done before leaving)",
    "Clean sink basin & drain ring; polish faucet",
    "Degrease stove top, knobs & control panel",
    "Lift stove grates & clean beneath",
    "Wipe microwave inside (top/plate) & outside",
    "Wipe oven door & handle (no self-clean run)",
    "Spot-clean oven interior if spills visible",
    "Wipe fridge exterior (handles, sides exposed)",
    "Spot-clean fridge interior shelves/drawers if needed",
    "Wipe dishwasher front & control panel",
    "Wipe small appliances (toaster, coffee maker, kettle)",
    "Empty & rinse coffee pot; restock filters",
    "Wipe backsplash & counters (move items, wipe under)",
    "Fronts of cabinets & pulls spot-cleaned",
    "Organize countertop items per staging",
    "Sweep & mop kitchen floor (edges & under toe-kicks)",
    "Empty kitchen trash/recycle; replace liners",
    "Restock paper towels, soap, sponge if provided",
  ],

  "Pantry / Owner’s Closet (if accessible)": [
    "Verify locked if required; otherwise organize",
    "Inventory supplies (paper towels, TP, liners, soaps)",
    "Count spares of sheets/towels if stored here",
    "Note low/out items in supplies log",
  ],

  "Dining Area": [
    "Wipe & polish table (under edges too)",
    "Wipe chairs & chair legs (food splatters)",
    "Straighten chairs; center decor per staging",
    "Sweep/vacuum & mop under table",
  ],

  "Living / Family Room": [
    "Dust & wipe TV stand, consoles, decor",
    "Dust TV screen (dry microfiber only)",
    "Disinfect remotes/game controllers",
    "Fold blankets; fluff pillows per photos",
    "Tidy books & magazines",
    "Vacuum sofa/chairs; check under cushions",
    "Clean any glass tops (coffee/end tables)",
  ],

  "Bedrooms (each)": [
    "Strip beds (if linens provided to change)",
    "Inspect mattress protector for stains/replace if needed",
    "Make beds to hotel corners (per staging photos)",
    "Arrange pillows & throws per staging",
    "Dust nightstands, headboards, lamps & decor",
    "Wipe dresser tops & drawer pulls",
    "Mirrors cleaned (streak-free)",
    "Closet fronts & handles wiped; floor vacuumed",
    "Under bed vacuumed (visible area)",
    "Remove trash; replace liners",
    "Vacuum/mop floors; check behind doors",
    "Set thermostat/fan as per policy (if in room)",
  ],

  "Bathrooms (each)": [
    "Empty trash; replace liner",
    "Dust light fixtures & vent cover",
    "Wipe cabinet fronts & pulls",
    "Clean mirrors & glass shelves (streak-free)",
    "Disinfect sink & faucet; polish to shine",
    "Wipe & disinfect counters & splash areas",
    "Scrub shower/tub walls & floor",
    "Remove soap scum & water spots (use right cleaner)",
    "Clean shower glass/door tracks (detail pass)",
    "Wipe shower fixtures & shelves; restage toiletries",
    "Scrub toilet bowl (under rim) with cleaner",
    "Disinfect toilet seat, lid, base & flush handle",
    "Wipe behind toilet & baseboards",
    "Refill hand soap & restock TP (2 extra rolls)",
    "Hang fresh towels per staging (face/hand/bath)",
    "Sweep & mop floor (behind door & corners)",
  ],

  "Laundry Room": [
    "Start/swap laundry per notes (linens/towels)",
    "Clean lint trap & washer gasket",
    "Wipe exterior of washer/dryer & controls",
    "Organize detergents/supplies; remove leaks/residue",
    "Sweep & mop floor",
    "Fold/hang laundry per staging if complete",
  ],

  "Office / Bonus Rooms": [
    "Dust desk, chair, shelves & decor",
    "Wipe monitors (dry microfiber only)",
    "Tidy cables where feasible",
    "Vacuum/mop floor",
  ],

  "Windows / Glass (interior only)": [
    "Spot-clean fingerprints & smudges",
    "Clean sliding door glass (inside) top-to-bottom",
    "Clean interior window sills & tracks (visible debris)",
  ],

  "Patio / Balcony": [
    "Sweep floor & corners (cobwebs)",
    "Wipe outdoor furniture surfaces",
    "Arrange cushions & decor per staging",
    "Clean sliding door track (visible debris)",
  ],

  "Garage": [
    "Quick sweep high-traffic areas",
    "Remove visible cobwebs",
    "Wipe door keypad/handle",
    "Ensure door closes/locks properly",
  ],

  "Trash / Recycle Days": [
    "Check local pickup days (notes/calendar)",
    "Take cans to curb (evening before pickup)",
    "Return cans after pickup (same day)",
    "Wipe bin lids/handles if soiled",
  ],

  "HVAC / Filters / Thermostat": [
    "Set thermostat per policy on departure",
    "Check return vent for dust; wipe grill",
    "Note dirty air filter (report if replacement needed)",
  ],

  "Supplies & Inventory": [
    "Check stock: TP, paper towels, trash liners",
    "Check soaps: hand, dish, laundry, dishwasher pods",
    "Check cleaning products & tools condition",
    "Note items low/out in supplies log",
    "Photograph shelf with supplies (optional)",
  ],

  "Damage / Lost & Found": [
    "Photograph & log any damage (chips, breaks, stains)",
    "Photograph & bag any left-behind items",
    "Place L&F in owner’s closet; label date/location",
    "Report urgent issues to office immediately",
  ],

  "Final Walk & Lockup": [
    "Lights set per policy (porch/night lights as needed)",
    "All faucets off; toilets flushed & lids down",
    "Windows/doors closed & locked",
    "Blinds/curtains staged per policy",
    "Thermostat set per policy",
    "All trash removed; fresh liners in place",
    "Take required ‘after’ photos (per room + issues)",
    "Alarm armed if applicable; lockbox reset",
  ],

  // DEEP-CLEAN SECTIONS (do on schedule or when assigned)
  "Deep Clean — Kitchen": [
    "Pull stove forward (if safe) & clean sides/floor",
    "Degrease hood/filters (if removable)",
    "Detail oven interior (assigned deep-clean only)",
    "Detail fridge interior (shelves/bins) & coils front grill",
    "Detail cabinet doors & hardware full wipe-down",
    "Detail backsplash grout/edges",
    "Baseboards & toe-kicks scrubbed",
  ],

  "Deep Clean — Bathrooms": [
    "Descale shower glass fully (hard-water remover)",
    "Detail grout & caulk lines; note mold/missing caulk",
    "Polish chrome to streak-free shine",
    "Clean exhaust vent cover (remove dust)",
    "Detail baseboards & behind toilet",
  ],

  "Deep Clean — All Areas": [
    "Move light furniture (safe) & clean underneath",
    "Vacuum under rugs; mop floor beneath if hard surface",
    "Wipe doors/top edges, trim & baseboards throughout",
    "Detail window tracks/sills thoroughly",
    "Wipe closet shelves/rods (empty or accessible)",
    "Spot-treat walls; note repaint needs if stains remain",
  ],

  "Photos (Before/After)": [
    "Entrance/living overview",
    "Kitchen overview + counters + appliances",
    "Each bathroom (sink, toilet, shower/tub)",
    "Each bedroom (bed made, floor)",
    "Laundry room (machines/lint trap)",
    "Patio/balcony",
    "Any damage/issues (close-ups + context shot)",
  ],
};

