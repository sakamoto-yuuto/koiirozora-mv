"""Prompt files for the v2 art (docs/STORYBOARD_v2.md). python make_jobs.py [batch] -> <name>.txt per job + jobs_<batch>.txt"""
import json, sys

OUT_RULE = ("After generation, copy the image file that YOUR OWN image_gen call returned (never search generated_images for the "
            "newest file: other jobs run in parallel) to __OUT__ with PowerShell Copy-Item. Do not resize or edit it. If the call "
            "fails, retry once. Reply only with the final path.")
INK = ("STRICT FLAT INKS - no gradients, no soft shading, no airbrush, no texture, no outlines except edges between ink shapes; "
       "shadows as one flat navy plane (cel-like). ")
BG = ("Use the built-in image_gen tool. Generate exactly ONE 16:9 landscape image: a BACKGROUND PLATE for a 2D anime music video, "
      "in the flat limited-ink SCREENPRINT style of the attached style references (flat ink shapes, halftone DOT SCREENS for light "
      "and shade, a few thin cream hairlines for structure, slightly misregistered prints). Palette ONLY: near-black navy #1B2230, "
      "deep navy #121925, slate #344256, ice blue-grey #AFC9D8, cream #F1E9DA, and ONE warm accent __ACCENT__ used only for lights. "
      + INK + "Setting: Tokyo, winter 1986 (Showa era). NO falling snowflakes in the air anywhere (snow lying on surfaces is fine; falling snow is animated in code later), NO people unless stated, NO readable text or letters anywhere (signs blank or "
      "with abstract marks only), no logos, no watermark. SCENE: __POSE__ " + OUT_RULE)
YUKI = ("Use the built-in image_gen tool. The first attached images are official 2009 TV-anime WHITE ALBUM character sheets of "
        "Morikawa Yuki (identity only: long straight wine-brown hair past the chest, center-right part, airy side bangs, small pale-blue "
        "flat barrette, cream high-neck knit, cream duffle coat outdoors, navy trousers, flat boots); the LAST attached image is the "
        "ink-style reference (match it exactly). Generate exactly ONE image: a flat three-colour SCREENPRINT of her, inks: cream #F1E9DA, "
        "wine-rose #8E3B4A (hair), navy #1B2230 (shadows, darkest parts), a tiny pale ice-blue only for the barrette. " + INK +
        "ANATOMY (strict, check before you finish): exactly ONE person with exactly TWO arms and TWO hands in every frame, each hand attached to its own arm, five fingers; no extra or floating limbs. BODY: slender, modest 19-year-old, small flat chest, loose knitwear hiding the figure, nothing sexualised. Face only as "
        "simple strokes unless stated. Background: one perfectly flat pure green #00FF00 over the whole canvas (chroma key), all "
        "figures fully inside with margin. No text, no watermark. CONTENT: __POSE__ " + OUT_RULE)
TOUYA = ("Use the built-in image_gen tool. ATTACHED IMAGES: (1) the OFFICIAL 2009 TV-anime WHITE ALBUM turnaround of Fujii Touya "
         "(front / side / BACK full body, his coat, his backpack, his hoodie); (2) his official head sheet (the bottom-left drawing is "
         "the BACK OF HIS HEAD); __YREF__the LAST image is the ink-style reference. FOLLOW THE OFFICIAL TURNAROUND STRICTLY - same design, "
         "same proportions, nothing invented: a slim, quiet university student about 20, average-tall, NARROW shoulders, thin chest and "
         "back, long legs, a slight relaxed slouch (not broad, not muscular, not a pretty-boy). HAIR: short layered soft black hair, "
         "ROUNDED at the back of the head, slightly longer soft messy nape, a few loose strands - NO spikes, NO pointed tufts, exactly the "
         "back-of-head drawing. COAT: off-white mid-thigh coat with front BUTTONS, two big patch pockets, a DARK BROWN collar lining "
         "visible at the collar, matte heavy cloth. HOODIE: a pale dusty-blue hoodie under the coat, hood down and lying outside the coat "
         "collar on his back, drawstrings. TROUSERS: dark slate-blue straight trousers bunching on the shoes. SHOES: brown lace-up "
         "leather shoes. BACKPACK (only when stated): olive-green canvas with a darker bottom and a small white label, carried on one "
         "shoulder. Print it as a flat limited-ink SCREENPRINT, inks: cream #F1E9DA (coat, skin), navy #1B2230 (hair, trousers, "
         "shadows), pale ice blue #AFC9D8 (his hoodie), and small areas of dark brown #5A4030 (collar lining, shoes) and olive "
         "#4E5A3E (backpack)__HER__. " + INK +
         "HIS FACE IS NEVER SHOWN: only his back, the back of his head, his shoulder, his hands; at most the rim of one ear. Background: "
         "one perfectly flat pure green #00FF00 over the whole canvas (chroma key), figures fully inside with margin. ANATOMY: exactly "
         "two arms and two hands per person, five fingers. No text, no watermark. CONTENT: __POSE__ " + OUT_RULE)
EXTRA = ("PASSERS-BY ARE EXTRAS: draw them deliberately SIMPLER and LESS DETAILED than the main characters of the reference - "
         "big flat shapes, very few folds, hair as one flat shape with no strands, faces as three or four simple strokes (no eye "
         "highlights, no irises, no lips), no fine accessories. They must never look like a main character. ")
PLAIN = ("Use the built-in image_gen tool. Generate exactly ONE image in the flat three-colour SCREENPRINT style of the attached "
         "style reference: inks cream #F1E9DA, navy #1B2230 and one accent __ACCENT__. " + INK + "Background: one perfectly flat "
         "pure green #00FF00 over the whole canvas (chroma key), subjects fully inside with margin. No text, no watermark. "
         "CONTENT: __POSE__ " + OUT_RULE)
SHEET = ("This is an ANIMATION SEQUENCE SHEET: __N__ frames of the SAME shot laid out side by side from left to right, evenly "
         "spaced, same scale, same camera, same character, IDENTICAL in every detail except the motion described; leave clear "
         "green gaps between frames. ")
AMB, ICE = "amber #E3A35A", "pale cream-yellow #F4E3B0"

jobs = {}
def bg(n, accent, pose): jobs[n] = BG.replace("__ACCENT__", accent).replace("__POSE__", pose)
def yk(n, pose, k=None): jobs[n] = YUKI.replace("__POSE__", (SHEET.replace("__N__", str(k)) if k else "") + pose)
def tw(n, pose, k=None, her=False):
    jobs[n] = (TOUYA.replace("__POSE__", (SHEET.replace("__N__", str(k)) if k else "") + pose)
               .replace("__YREF__", "(3) Morikawa Yuki's official sheet (the girl, identity only); " if her else "")
               .replace("__HER__", ", and for HER wine-rose #8E3B4A (her long hair), her cream duffle coat and navy trousers" if her else ""))
def pl(n, accent, pose): jobs[n] = PLAIN.replace("__ACCENT__", accent).replace("__POSE__", pose)

batch = sys.argv[1] if len(sys.argv) > 1 else "1"
if batch == "1":
    bg("bg_street_night", ICE, "an empty snowy shopping street (shotengai) at night at eye level, low two-storey shops with closed shutters and a few lit upper windows, telephone poles with sagging wires, snow lying on roofs and the ground, a cold mercury street lamp; at the right third a lit 1985-type phone booth (brown frame, three glass sides glowing cold white, a green public phone inside). Leave the left half of the street open for a figure to walk. Wide.")
    bg("bg_street_dusk", AMB, "the SAME kind of shopping street at winter dusk (a warm memory): low amber sun at the end of the street as a big halftone disc, long shadows, vertical lightbox shop signs (blank), shop awnings, no snow falling, a warm glow on the pavement. Wide, eye level, the street receding to the centre.")
    bg("bg_street_dawn", "pale peach #F2C9A6", "the SAME snowy shopping street at dawn: pale sky, fresh snow, the phone booth at the right third now unlit, everything quiet and clean. Wide, eye level.")
    bg("bg_booth_front", ICE, "the SAME phone booth as in the FIRST attached image (the lit booth on the right of that snowy shopping street: brown aluminium frame, snow on its roof), now seen from the front at night, filling the frame, the closed shop shutters of the same street behind it: brown aluminium frame, roof with snow on it, three glass sides glowing cold white from a tube light inside, a green public telephone hanging on the back wall, a small shelf with a phone directory, frosted condensation at the bottom of the glass. The inside is EMPTY (a person will be composited inside). Snowy pavement in front.")
    bg("bg_platform_night", ICE, "a small Japanese commuter train platform at night in winter, seen along the platform: platform edge line, a pillar with a blank station name board, overhead lamps as dot-screen cones, the empty track on the right, snow at the platform end. No train.")
    bg("bg_tv_shop", ICE, "a small electronics shop window at night seen from the snowy street: a glass shopfront with a wall of stacked CRT television sets of different sizes (8-12 sets); EVERY SCREEN is a plain flat dark grey rectangle (pictures will be composited later); a blank shop sign above; the shop interior lit; a snowy pavement in front with room for figures.")
    bg("bg_his_room_night", ICE, "a small 1986 Japanese apartment room (six tatami) at night with the light off: a low table with a cream push-button telephone and a small answering machine on it, a window on the right with snow light falling into the room as a dot screen, a door on the left, an EMPTY coat hook by the door, a bookshelf, a futon folded in the corner. Quiet, empty.")
    bg("bg_his_room_warm", AMB, "the SAME small 1986 Japanese apartment room, evening, a warm desk lamp on (a memory): a low table in the centre (clear, nothing on it), a window with night outside, warm light pools as dot screens, cosy.")
    bg("bg_her_room_night", ICE, "a young woman's small room at night in winter, light off: a window with snow outside and a cold glow, the edge of a bed, a desk with a small radio-cassette player, a cardigan over a chair, empty floor space under the window for a sitting figure.")
    bg("bg_window_family", AMB, "seen from a dark snowy street: one warm lit window of a Japanese house at night; behind the thin curtain, the SILHOUETTES of a family around a kotatsu table (parents and a small child), steam from a pot. Only that window is warm; the rest dark.")
    bg("bg_window_couple", AMB, "seen from a dark snowy street: a warm lit window of an apartment at night; behind the curtain, the SILHOUETTES of a young couple standing close, one leaning on the other's shoulder. The rest dark.")
    bg("bg_window_old", AMB, "seen from a dark snowy street: the warm lit window of a small shop-house at night; behind the glass, the SILHOUETTE of an old couple sitting side by side watching TV. The rest dark.")
    bg("bg_train_car", ICE, "ONE 1980s Japanese commuter train car seen exactly from the side, filling the width, windows lit cold white from inside, nobody visible; isolated on a perfectly flat pure green #00FF00 background (chroma key) above and below the car.")
    yk("y_walk_sheet", "FULL BODY strict side view walking to the right, wearing EXACTLY the outfit of the LAST attached image: the cream DUFFLE COAT with toggles, hood and patch pocket, buttoned cuffs, over navy trousers, NAVY flat ankle boots (outdoors in snow she always wears the coat), long hair moving. A 4-frame WALK CYCLE where EVERY FRAME HAS A DIFFERENT LEG POSITION: frame 1 CONTACT - legs widest apart, front heel just touching the ground, back toe on the ground, arms swung opposite; frame 2 DOWN - front foot flat, front knee bent, body at its lowest, back foot lifting off; frame 3 PASSING - the standing leg straight under the body, the other leg bent and passing beside it (knees together), arms by the sides, body rising; frame 4 UP - body highest on the toes of the standing foot, the free leg swinging forward. The head stays at the same height within 3%. Each frame: two arms, two hands.", 4)
    yk("y_lift_sheet", "waist-up three-quarter view inside a phone booth (the booth itself not drawn): frame 1 her hand reaches for a grey telephone receiver on its hook at the left edge; frame 2 lifting it; frame 3 the receiver held at her ear, eyes lowered. The receiver's coiled cord visible.", 3)
    yk("y_wait_sheet", "bust three-quarter view holding a grey telephone receiver to her ear, waiting: frame 1 eyes open looking down-left (simple almond eye shapes); frame 2 eyes closed (two short strokes). Everything else identical.", 2)
    yk("y_listen_sheet", "bust three-quarter view, receiver at her ear: frame 1 eyes open, slightly surprised, looking straight ahead; frame 2 eyes lowered, mouth a small sad line, she takes a breath.", 2)
    yk("y_smile_sheet", "side profile facing left, bust, receiver at her ear, eyes closed: frame 1 neutral; frame 2 a faint tender smile.", 2)
    yk("y_wave_sheet", "waist-up, front three-quarter, on a station platform (platform not drawn), waving goodbye with her right hand in a cream knitted glove: frame 1 hand left, frame 2 hand centre, frame 3 hand right; a brave small smile, eyes glistening.", 3)
    yk("y_eye_tear_sheet", "EXTREME CLOSE-UP of her eye and brow (one eye, hair strands across): frame 1 eye open, dry; frame 2 a tear welling on the lower lid (a small flat cream shape); frame 3 the tear runs down the cheek. Landscape frames.", 3)
    yk("y_receiver_close_sheet", "close-up side profile facing right, head and shoulders, pressing a grey telephone receiver hard against her ear with both hands, eyes closed: frame 1; frame 2 the same but head tilted further into the receiver, brows drawn together.", 2)
    yk("y_stage_sheet", "on a concert stage, waist-up, three-quarter view, singing into a vintage stage microphone on a stand, wearing a white sleeveless high-collar stage dress with long navy gloves. In BOTH frames her LEFT hand (nearest the microphone) holds the microphone stand just below the microphone, and that is the only hand on the stand. Frame 1: eyes closed, singing, her RIGHT hand rests on her chest. Frame 2: eyes half open, her RIGHT arm (the same right arm as frame 1, now lifted) reaches out to the audience with an open palm; nothing else changes. TWO hands per frame, never three.", 2)
    yk("y_stop_back", "FULL BODY seen from behind in the snow, cream duffle coat: she has just stopped walking, her head turned slightly to the right as if she saw someone she knows; one hand half raised.")
elif batch == "2":
    tw("yt_walk_back", "the girl (Yuki: cream duffle coat, long wine-brown hair, navy trousers, flat boots) on the LEFT and the young man (Touya, exactly as the turnaround BACK view) on the RIGHT, walking side by side AWAY from the viewer, full bodies seen from directly behind, holding hands between them (her left hand in his right hand). A 4-frame WALK CYCLE.", 4, her=True)
    tw("yt_hands_back", "medium shot from behind and slightly low: the girl (left) and the young man (right) walking side by side, framed only from the waist down to the knees, their hands joined between them: her cream knitted glove in his bare right hand, which comes out of his off-white coat sleeve with the pale-blue hoodie cuff showing. His other hand in his coat pocket.", her=True)
    tw("yt_train_window", "the young man seen from behind and slightly to his right, head and shoulders only, as if through a train window: the rounded back of his head (exactly the back-of-head drawing), his off-white coat collar with the dark brown lining, the pale-blue hood lying on his back; he does not turn around. A simple rounded-rectangle train window frame around him in navy; inside the frame behind him is green.")
    tw("yt_back_crowd", "FULL BODY seen from directly behind, exactly the turnaround BACK view: the young man walking away, hands in his coat pockets, no backpack.")
    tw("yt_back_bust", "bust seen from directly behind: the young man's head and shoulders, head slightly lowered, the rounded back of his head, the pale-blue hood on his back over the off-white coat.")
    tw("yt_scarf", "close shot from behind the girl: the young man (only his two hands and his off-white coat sleeves with pale-blue hoodie cuffs, his body out of frame behind her) wraps a long amber #E3A35A knitted scarf around her neck; she (seen from behind / three-quarter back, long wine-brown hair) closes her eyes, her face in profile with a small smile. The scarf is the only amber.", her=True)
    tw("his_enter_back", "FULL BODY seen from behind: the young man stepping into a dark room through an open door, snow on his shoulders and hair, the olive-green backpack on his left shoulder, his right hand still on the door handle.")
    tw("his_hand_press", "only HIS right hand (bare, slim fingers, from an off-white coat sleeve with the pale-blue hoodie cuff) reaching in from the right and pressing down one square cream button with the index finger, the other fingers loosely curled. Hand and sleeve only. Landscape 16:9.")
    pl("passers_a", "slate blue-grey #6E7F94", "" + EXTRA + "three different adult passers-by walking LEFT in winter coats, full bodies in side view, spaced apart: a salaryman with a briefcase and a closed umbrella, a woman with a shopping bag, an old man with a cap. Same anime screenprint style as the reference; faces only simple strokes.")
    pl("passers_b", "slate blue-grey #6E7F94", "" + EXTRA + "three different passers-by walking RIGHT in winter coats, full bodies in side view, spaced apart: a student with a school bag, a young couple close together, a mother holding a child's hand. Faces only simple strokes.")
    jobs["passer_turn_sheet"] = PLAIN.replace("__ACCENT__", "slate blue-grey #6E7F94").replace("__POSE__", SHEET.replace("__N__", "2") + EXTRA + "waist up, three-quarter BACK view of a man in an off-white mid-length coat with short black hair (from behind he looks like the young man of the attached turnaround). Frame 1: seen from behind, he is not turning. Frame 2: he turns his head back over his shoulder and we see clearly that he is a STRANGER: a plain MIDDLE-AGED man about 45, round face, small moustache, heavier jaw - an ordinary extra drawn with only a few strokes, obviously not a young man, NO glasses. Same coat, same hair from behind. Hands in his coat pockets in both frames.")
    pl("crowd_concert", "wine-rose #8E3B4A", "" + EXTRA + "a concert audience seen from behind the stage lights: rows of heads and raised arms, some waving glow sticks, as a dense rhythmic silhouette pattern filling a 16:9 landscape image (no green needed at the bottom: the crowd fills the lower 70%, flat green above).")
    pl("kanji_jaku", "navy #1B2230", "the single kanji 寂 written in flowing Japanese SOSHO (grass-script) brush calligraphy, one large character, black ink with dry-brush streaks and a few ink splashes, on the green background; nothing else. Square 1:1. (Here ink colour is near-black navy only.)")
    pl("h_card_insert", "wine-rose #8E3B4A", "close-up: a woman's hand in a cream knitted glove pushing a small rectangular telephone card into a slot of a green public telephone (only the slot area of the green phone visible at the right). Landscape 16:9.")
    pl("h_dial_b", "wine-rose #8E3B4A", "close-up of the FRONT PANEL of a 1985 Japanese card PUBLIC telephone inside a phone booth (NOT a home phone): its body printed in slate #344256 and navy #1B2230 (never green), a 3x4 keypad of square cream keys (labels as tiny blank marks, no readable digits), and above the keypad a small dark rectangular LED window (unlit, empty). A woman's slender BARE right hand (no glove at all - she took it off to dial; skin in cream, nails unpainted) comes in from the right out of a cream duffle-coat sleeve with a buttoned cuff, and presses one key with her index finger; thumb and the other fingers relaxed and curled. One hand, five fingers, the whole hand the same bare skin. Landscape 16:9.")
elif batch == "3":
    pl("fg_pole_near", "pale cream-yellow #F4E3B0", "a FOREGROUND element for parallax: ONE Japanese wooden utility pole seen very close, running from the bottom edge to the top edge of a tall 9:16 portrait image, with snow stuck on its windward side, a transformer can, a few insulators and the stubs of sagging wires leaving the frame, a small street-lamp arm with a lamp. Inks: navy #1B2230 (the pole), slate #344256 (its shading), cream #F1E9DA (snow); the lamp in the accent.")
    pl("fg_snowbank_near", "ice blue-grey #AFC9D8", "a FOREGROUND strip for parallax: a long low snowbank along a low wooden fence, seen very close at ground level, filling the bottom 40% of a WIDE 21:9 image across its whole width (flat green above), soft heaped snow in cream #F1E9DA with ice-blue #AFC9D8 dot-screen shade, the fence slats in navy #1B2230.")
elif batch == "4":
    jobs["obj_machine_sheet"] = PLAIN.replace("__ACCENT__", "deep red #C23E36 (only the two small lamps)").replace("__POSE__", SHEET.replace("__N__", "3") +
        "a CLOSE-UP of a 1986 Japanese home answering machine (rusuban denwa) seen from the front and slightly above, filling each frame: a "
        "boxy cream #F1E9DA plastic body with navy #1B2230 shading, a smoked dark window in the top showing a MICRO-CASSETTE with its TWO "
        "REELS clearly visible (each reel a hub with six spokes), a row of five square push buttons along the front, two small round lamps "
        "on the left of the window (both OFF, dark red #6A2A2A). The ONLY difference between the frames: the two reel hubs are rotated by "
        "0, 20 and 40 degrees. No readable text (the button labels as tiny blank rectangles).")
elif batch == "5":
    pl("h_finger_glass", "wine-rose #8E3B4A", "a woman's slender BARE right hand seen from the OTHER side of a window pane (we are outside the glass): only the index finger extended, its fingertip pressed flat on the glass at the TOP of the image, the other fingers loosely curled, the hand and a cream duffle-coat sleeve with a buttoned cuff coming up from the bottom edge, slightly diagonal from bottom right to top left. Portrait 3:4. One hand, five fingers, all bare skin.")
elif batch == "6":
    GUIDE = ("The FIRST attached image is a LAYOUT / POSE GUIDE only (thin lines on white): follow its positions, sizes, framing and "
             "poses exactly, but do NOT copy its lines, labels or colours - the picture itself is drawn in the style described below. ")
    jobs["obj_phone_panel"] = ("Use the built-in image_gen tool. " + GUIDE + "Generate exactly ONE PORTRAIT 9:16 image in the flat limited-ink "
        "SCREENPRINT style of the other attached reference (flat ink shapes, a few halftone dot screens, thin cream hairlines). " + INK +
        "CONTENT: the flat-on FRONT of a 1985 Japanese NTT card public telephone (MC-3P type) as a separate OBJECT: body in public-phone "
        "GREEN #3E8E5E with darker green #24583A shading and cream #F1E9DA highlights; on the left an EMPTY receiver hook (the receiver is "
        "lifted off and NOT in the picture) with the coiled cord rising from its socket and leaving the top-left edge; above the keypad a "
        "small DARK rectangular LED window, unlit and empty; a 3x4 keypad of square cream keys (labels as tiny blank marks, no readable "
        "digits); on the right a horizontal card slot with a small arrow mark, a thin coin slot, a coin-return cup; a blank instruction "
        "sticker. Background: one perfectly flat pure MAGENTA #FF00FF over the whole canvas (chroma key), the phone fully inside with "
        "margin. No text, no watermark, no hands, no people. " + OUT_RULE)
    jobs["h_card_hand"] = PLAIN.replace("__ACCENT__", "wine-rose #8E3B4A").replace("__POSE__", GUIDE + "a woman's slender BARE right "
        "hand (no glove; skin cream, unpainted nails) coming in from the right out of a cream duffle-coat sleeve with a buttoned cuff, "
        "holding a telephone card flat and horizontal between thumb and fingers, the card's LEFT edge leading, pushing it to the left. The "
        "card: cream with one diagonal wine-rose stripe and a small blank logo. Only the hand, the sleeve and the card - NO phone, NO slot. "
        "One hand, five fingers. Landscape 16:9.")
    jobs["h_press_hand"] = PLAIN.replace("__ACCENT__", "wine-rose #8E3B4A").replace("__POSE__", GUIDE + "a woman's slender BARE right "
        "hand (no glove; skin cream, unpainted nails) coming in from the right out of a cream duffle-coat sleeve with a buttoned cuff, back "
        "of the hand up, ONLY the index finger extended and pointing down-left to press a key, the fingertip exactly where the guide marks "
        "it; thumb and the other three fingers curled. Only the hand and the sleeve - NO phone, NO keys. One hand, five fingers. "
        "Landscape 16:9.")
elif batch == "7":
    GUIDE = ("The FIRST attached image is a LAYOUT / POSE GUIDE only (thin lines and coloured bone chains on white): follow its positions, "
             "sizes and the pose of every finger exactly (red = index, blue = thumb, other colours = the other fingers), but do NOT copy "
             "its lines, labels or colours. The SECOND attached image shows the SAME hand in the right style and anatomy: match its skin, "
             "nails, line weight and sleeve. ")
    HAND = (" ANATOMY (check before finishing): one RIGHT hand, five fingers, a clearly drawn thumb with its nail, knuckles in a "
            "natural arc, the wrist straight and continuing into the forearm INSIDE the sleeve (no twisted wrist, no extra joints). The "
            "sleeve is the cream duffle coat: cream with navy shading and a buttoned cuff, NO coloured trim. Only the hand and the sleeve.")
    jobs["h_press_hand2"] = PLAIN.replace("__ACCENT__", "wine-rose #8E3B4A (only for the faint shadow lines in the skin)").replace("__POSE__", GUIDE +
        "her bare right hand seen from the THUMB side, palm facing down, coming in from the right out of the coat sleeve: the INDEX finger "
        "straight and angled down-left, its tip exactly in the box marked 'fingertip' (it presses a key that is not drawn); the THUMB "
        "under the index finger, relaxed, its tip visible; middle, ring and little fingers curled under the palm, their knuckles in a row. "
        "NO phone, NO keys." + HAND + " Landscape 16:9.")
    jobs["h_card_hold"] = PLAIN.replace("__ACCENT__", "wine-rose #8E3B4A").replace("__POSE__", GUIDE +
        "her bare right hand from the bottom right out of the coat sleeve, holding a telephone card UPRIGHT in front of her by its "
        "bottom-right corner: the thumb tip on the card's front, the index finger behind it, the other fingers curled. The card exactly in "
        "the guide box, flat, facing us, long edges horizontal: cream with one diagonal wine-rose stripe and a small round wine-rose mark; "
        "its TOP edge clean and straight. NO phone, NO slot." + HAND + " Landscape 16:9.")
elif batch == "8":
    G8 = ("The FIRST attached image is a LAYOUT GUIDE only (boxes and labels on white): put each object in its box, but do NOT copy the "
          "boxes, labels or colours. The SECOND attached image is the room these objects will be placed in (they will stand on its low "
          "table): match its camera angle, its warm evening lamp light from the upper left and its flat screenprint style. ")
    jobs["obj_table_set"] = PLAIN.replace("__ACCENT__", "amber #E3A35A").replace("__POSE__", G8 +
        "SEVEN separate small objects for a still life on a low table, each standing alone with clear green space around it (they must "
        "not touch or overlap), all seen from the same camera, from the front and above at about 40 degrees: two simple mugs side by side "
        "but separate (one cream, one amber), each with a thin curl of steam; a cassette tape in its clear case; a small key ring with two "
        "keys; a closed music magazine lying flat (blank cover with an abstract shape, no letters); a red camellia flower with two leaves "
        "(the red printed in wine-rose #8E3B4A); a pair of knitted gloves lying flat. Each object casts a small flat navy shadow under "
        "itself. No table, no background, no text.")
elif batch == "9":
    yk("y_fist_booth", "bust, three-quarter view facing left, inside a phone booth at night (booth not drawn), wearing EXACTLY the outfit of the last attached image's girl in the booth: the cream DUFFLE COAT with toggles over the cream high-neck knit. Her LEFT hand holds a grey telephone receiver at her left ear; her RIGHT hand is clenched into a fist and pressed against her chest over the coat; eyes closed, brows drawn together, lips pressed, holding back tears. Each hand clearly attached to its own arm; two hands only.")
elif batch == "10":
    WALK = ("A 4-frame WALK CYCLE where EVERY FRAME HAS A DIFFERENT LEG POSITION: frame 1 CONTACT - legs widest apart, front heel just "
            "touching the ground; frame 2 DOWN - front foot flat, front knee bent, body lowest, back foot lifting; frame 3 PASSING - the "
            "standing leg straight under the body, the other leg bent passing beside it; frame 4 UP - body highest, the free leg swinging "
            "forward. The head stays at the same height within 3%. BOTH HANDS stay in his coat pockets in every frame (no hands visible). ")
    tw("yt_walk_side_sheet", "FULL BODY strict SIDE view of the young man walking to the RIGHT through snow at night, exactly the turnaround side view: off-white buttoned coat, pale dusty-blue hood out over the collar, dark slate trousers, brown lace-up shoes, the olive-green backpack slung over his far shoulder and visible behind his back, a little snow on his shoulders and hair; head slightly lowered against the cold. HIS FACE IS NOT SHOWN: the side of his head is turned a little away so only the ear, the hair and the jaw line show, no eye, nose or mouth. " + WALK, 4)
    tw("yt_walk_away_sheet", "FULL BODY seen from DIRECTLY BEHIND, the young man walking AWAY from the viewer through snow at night, exactly the turnaround back view: off-white coat, pale dusty-blue hood on his back, dark slate trousers, brown shoes, the olive-green backpack on his LEFT shoulder, a little snow on his shoulders. " + WALK, 4)
elif batch == "11":
    # 恋色の空: the paper slip of the hero words (blank: the characters are printed in code) and him looking up at the same sky
    pl("obj_tanzaku", "wine-rose #8E3B4A", "ONE Japanese TANZAKU paper slip hanging straight down, seen flat-on, upright and large in the centre: "
       "a tall narrow rectangle of thick washi paper (width : height about 1 : 3.2), CREAM, with one flat navy shadow plane along its right "
       "edge and its bottom edge (the paper is slightly bent), soft fibrous paper edges, the bottom-left corner a little curled; at the top a "
       "small punched hole with a short twisted string through it, the string tied in a small loop above the slip, the string in the accent "
       "colour. The paper face is COMPLETELY BLANK: no writing, no letters, no marks, no pattern. Only this one slip, nothing else.")
    jobs["yt_look_up"] = ("Use the built-in image_gen tool. EDIT the FIRST attached image (a flat screenprint of a young man seen from "
       "directly behind, head and shoulders). The second and third attached images are his OFFICIAL turnaround and head sheet (the "
       "bottom-left drawing there is the back of his head): keep him exactly on model. KEEP EVERYTHING IDENTICAL - same canvas size, same "
       "framing and scale, same shoulders and coat, the same pale dusty-blue hood lying on his back, the same dark brown collar lining, the "
       "same inks and flat green #00FF00 background. CHANGE ONLY HIS HEAD: he has stopped and TILTED HIS HEAD BACK to look up at the sky, "
       "high above him. Seen from behind, this means: the back of his head sinks down and back towards the hood and collar, the nape is "
       "hidden, the hair at the back of his neck rests on the collar, the crown of the head turns away from us so we see less of the top of "
       "the head and more of the rounded back of the skull; at the right edge of the head only the outline of the jaw tilted UP and the rim "
       "of one ear (NO face, no eye, no nose, no mouth). Hair: short soft layered black hair, rounded at the back, no spikes. Exactly one "
       "person, no hands visible. No text, no watermark. " + OUT_RULE)
json.dump(list(jobs), open(f"jobs_{batch}.json", "w"))
for n, p in jobs.items():
    open(f"{n}.txt", "w", encoding="utf8").write(p)
print(batch, len(jobs))
