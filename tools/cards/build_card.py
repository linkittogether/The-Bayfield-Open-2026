#!/usr/bin/env python3
"""
Generate a self-contained MTG-style Bayfield player trading card (single HTML file).

    python3 build_card.py players/joe.json [out.html]

The card frame/proportions/bevels are ported from the community "Magic: the
Gathering Card Designer" Figma file (see README.md for file key + node ids).
Everything (fonts, frame texture, player art, set mark) is inlined as data URIs
so the output is a self-contained page suitable for publishing as an Artifact.

Player JSON schema (see players/joe.json):
{
  "name":      "Joe McCulla",
  "type":      "Legendary Creature — Human Golfer",
  "team":      "truffle_hogs" | "mycelium_syndicate",   # -> frame colour
  "frame":     "land",           # optional: override the team->frame mapping
  "handicap":  "8",              # value shown in the colourless mana pip
  "art":       "joe-art.jpg",    # path relative to this JSON file
  "artPosition":"60% 50%",       # optional CSS object-position for the art
  "abilities": ["<html>", ...],  # rules-text lines (inline HTML ok; see classes)
  "flavor":    "…",              # italic flavour text
  "collector": "003/021",        # collector number
  "rarity":    "M",              # rarity letter shown in the metadata line
  "caption":   "Joe McCulla · Truffle Hogs 🐗"   # small line under the card
}

Ability HTML helper classes: .yr (year, bold) .win (bold) .trophy (gold) .dq (red italic)
"""
import base64, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")

# team -> frame colour
TEAM_FRAME = {"truffle_hogs": "land", "mycelium_syndicate": "blue"}

# per-frame palette: the smooth title/type plates + parchment text box.
# (frame texture itself lives in assets/frames/<key>.jpg)
FRAMES = {
    "land":  dict(plate=("#efe8d6", "#dccfb0", "#c4b58d"), box=("#f4eedd", "#e6dbc2")),
    "blue":  dict(plate=("#dbe7f4", "#a7c1de", "#7c9ec1"), box=("#eef4fb", "#d9e6f2")),
    "red":   dict(plate=("#f1d8d0", "#d6998c", "#b46a5a"), box=("#fbeee9", "#f2d9cf")),
    "gold":  dict(plate=("#f2e6c0", "#dcc98a", "#bfa65e"), box=("#fbf3da", "#efe0b8")),
    "green": dict(plate=("#dfe9d3", "#adc79f", "#84a06f"), box=("#eef4e6", "#dde9cf")),
    "black": dict(plate=("#d7d2cb", "#9a938a", "#6f685f"), box=("#e9e6df", "#cfcabf")),
    "white": dict(plate=("#f7f3e6", "#e5dcc4", "#cdbf9c"), box=("#faf7ee", "#ece5d2")),
}

FONTS = [
    ("Merri", "400", "normal", "merriweather-400.woff2"),
    ("Merri", "700", "normal", "merriweather-700.woff2"),
    ("Merri", "400", "italic", "merriweather-400i.woff2"),
    ("PlayfairD", "700", "normal", "playfair-700.woff2"),
    ("PlayfairD", "800", "normal", "playfair-800.woff2"),
]


def b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: build_card.py <player.json> [out.html]")
    jpath = sys.argv[1]
    data = json.load(open(jpath))
    jdir = os.path.dirname(os.path.abspath(jpath))
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(jpath)[0] + ".html"

    frame_key = data.get("frame") or TEAM_FRAME.get(data.get("team", ""), "land")
    pal = FRAMES[frame_key]

    frame_b64 = b64(os.path.join(ASSETS, "frames", frame_key + ".jpg"))
    logo_b64 = b64(os.path.join(ASSETS, "logo.png"))
    art_b64 = b64(os.path.join(jdir, data["art"]))

    faces = "\n".join(
        f"@font-face{{font-family:'{fam}';font-style:{st};font-weight:{w};font-display:swap;"
        f"src:url(data:font/woff2;base64,{b64(os.path.join(ASSETS,'fonts',fn))}) format('woff2');}}"
        for fam, w, st, fn in FONTS
    )
    abilities = "\n        ".join(f"<p>{a}</p>" for a in data["abilities"])
    tokens = {
        "FACES": faces,
        "FRAME": frame_b64, "LOGO": logo_b64, "ART": art_b64,
        "PLATE_HI": pal["plate"][0], "PLATE_MID": pal["plate"][1], "PLATE_LO": pal["plate"][2],
        "BOX_HI": pal["box"][0], "BOX_LO": pal["box"][1],
        "NAME": data["name"], "TYPE": data["type"], "PIP": data.get("handicap", ""),
        "ARTPOS": data.get("artPosition", "50% 50%"),
        "ABILITIES": abilities, "FLAVOR": data.get("flavor", ""),
        "COLLECTOR": data.get("collector", ""), "RARITY": data.get("rarity", ""),
        "CAPTION": data.get("caption", data["name"]),
    }
    html = TEMPLATE
    for k, v in tokens.items():
        html = html.replace("{{" + k + "}}", str(v))
    open(out, "w").write(html)
    print(f"wrote {out} ({len(html)} bytes, frame={frame_key})")


TEMPLATE = r"""<style>
{{FACES}}
:root{
  --frame:url(data:image/jpeg;base64,{{FRAME}});
  --card-w:min(90vw,500px);
  --ink:#17140f;
  --plate-hi:{{PLATE_HI}}; --plate-mid:{{PLATE_MID}}; --plate-lo:{{PLATE_LO}};
  --box-hi:{{BOX_HI}}; --box-lo:{{BOX_LO}};
}
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:grid;place-items:center;padding:28px 16px;
  background:radial-gradient(120% 120% at 50% 0%,#123a29 0%,#0a2418 45%,#05130c 100%);
  font-family:'Merri',Georgia,serif;-webkit-font-smoothing:antialiased;}
.wrap{display:flex;flex-direction:column;align-items:center;gap:18px}
.card{position:relative;width:var(--card-w);aspect-ratio:672/936;background:var(--ink);
  border-radius:5%/3.6%;overflow:hidden;isolation:isolate;
  box-shadow:0 24px 60px -18px rgba(0,0,0,.85),0 4px 14px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.04);}
.frame{position:absolute;inset:2.4% 3.0% 5.8% 3.0%;border-radius:3.5%/2.4%;
  background-image:var(--frame);background-size:130% 130%;background-position:30% 20%;
  box-shadow:0 0 0 1px rgba(0,0,0,.6),
    inset 0 0 0 1.5px rgba(255,244,205,.55),
    inset 0 3px 7px rgba(255,240,190,.5),
    inset 0 -12px 20px rgba(58,36,8,.6);}
.plate{background:
    linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,0) 22%,rgba(0,0,0,.06) 60%,rgba(0,0,0,.16)),
    linear-gradient(180deg,var(--plate-hi) 0%,var(--plate-mid) 52%,var(--plate-lo) 100%);
  border-radius:7px;
  box-shadow:0 0 0 2px rgba(26,16,4,.92),0 0 0 3px rgba(255,244,220,.22),
    inset 0 2px 2px rgba(255,252,244,.75),inset -2px -5px 6px rgba(28,17,5,.4);}
.namebar{position:absolute;top:5.0%;left:5.9%;right:5.8%;height:5.9%;display:flex;align-items:center;padding:0 12px 0 16px;gap:8px;}
.name{font-family:'PlayfairD',Georgia,serif;font-weight:800;color:var(--ink);font-size:clamp(17px,4.4vw,25px);
  letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;text-shadow:0 1px 0 rgba(255,245,210,.5);}
.cost{display:flex;gap:3px;align-items:center;flex-shrink:0}
.pip{width:clamp(20px,5vw,27px);aspect-ratio:1;border-radius:50%;display:grid;place-items:center;
  background:radial-gradient(circle at 38% 30%,#e6ddc9,#c3b596 60%,#9c8c68);color:#211b10;
  font-family:'Merri',serif;font-weight:700;font-size:clamp(12px,3vw,16px);
  box-shadow:-0.5px 2px 0 #000,inset 0 2px 2px rgba(255,255,255,.6),inset 0 -2px 3px rgba(0,0,0,.35);}
.art{position:absolute;top:11.8%;left:8.4%;right:8.3%;height:42.2%;overflow:hidden;border-radius:2px;
  box-shadow:
    0 0 0 3px rgba(24,15,4,.95),          /* dark groove hugging the art */
    0 0 0 4.5px rgba(255,240,205,.4),      /* light lip = raised coloured frame edge */
    inset 0 3px 7px rgba(0,0,0,.6),
    inset 0 -2px 5px rgba(0,0,0,.5);}
.art img{width:100%;height:100%;object-fit:cover;object-position:{{ARTPOS}};display:block}
.typebar{position:absolute;top:56.4%;left:5.9%;right:5.8%;height:5.6%;display:flex;align-items:center;padding:0 8px 0 16px;gap:8px;}
.type{font-family:'PlayfairD',Georgia,serif;font-weight:700;color:var(--ink);font-size:clamp(12px,3.1vw,17px);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;}
.setsym{height:74%;width:auto;flex-shrink:0;filter:brightness(0) saturate(100%);opacity:.82;}
.textbox{position:absolute;top:63.5%;left:8.4%;right:8.3%;bottom:8%;background:linear-gradient(180deg,var(--box-hi),var(--box-lo));
  box-shadow:
    0 0 0 3px rgba(24,15,4,.92),
    0 0 0 4.5px rgba(255,240,205,.4),
    inset 1px 2px 3px rgba(255,255,255,.45),inset -2px -3px 5px rgba(120,90,50,.3);
  border-radius:3px;padding:6% 6.5% 5.5%;display:flex;flex-direction:column;color:#1a140d;
  font-size:clamp(11px,2.75vw,15px);line-height:1.28;overflow:hidden;}
.abil{display:flex;flex-direction:column;gap:5px}
.abil p{margin:0}
.yr{font-weight:700;font-variant-numeric:tabular-nums}
.win{font-weight:700}
.trophy{color:#9a6b00}
.dq{color:#8a2b1c;font-style:italic}
.divider{height:0;border-top:2px solid transparent;
  border-image:linear-gradient(90deg,transparent,rgba(120,80,20,.75),transparent) 1;margin:7px 2px;}
.flavor{font-style:italic;font-size:clamp(10.5px,2.6vw,14px);line-height:1.3;color:#241a11}
.meta{position:absolute;left:6.4%;bottom:2.1%;color:#ededed;line-height:1.15;}
.meta .l1{font-weight:700;font-size:clamp(8px,2vw,11px);letter-spacing:.5px;font-variant-numeric:tabular-nums}
.meta .l2{font-size:clamp(7px,1.8vw,10px);letter-spacing:.6px;opacity:.92}
.cw{position:absolute;right:6%;bottom:2.4%;color:#ededed;font-size:clamp(7px,1.7vw,9.5px);opacity:.85;text-align:right}
.caption{color:#cdb98a;font-family:'Merri',serif;font-size:13px;letter-spacing:.4px;text-align:center;max-width:var(--card-w)}
.caption b{color:#f0dcae;font-weight:700}
</style>

<div class="wrap">
  <div class="card">
    <div class="frame"></div>
    <div class="namebar plate">
      <span class="name">{{NAME}}</span>
      <span class="cost"><span class="pip">{{PIP}}</span></span>
    </div>
    <div class="art"><img src="data:image/jpeg;base64,{{ART}}" alt="{{NAME}}"></div>
    <div class="typebar plate">
      <span class="type">{{TYPE}}</span>
      <img class="setsym" src="data:image/png;base64,{{LOGO}}" alt="Bayfield">
    </div>
    <div class="textbox">
      <div class="abil">
        {{ABILITIES}}
      </div>
      <div class="divider"></div>
      <p class="flavor">{{FLAVOR}}</p>
    </div>
    <div class="meta">
      <div class="l1">{{COLLECTOR}} &nbsp;★{{RARITY}}</div>
      <div class="l2">BAY · EN &nbsp;·&nbsp; THE BAYFIELD OPEN</div>
    </div>
    <div class="cw">™ &amp; © The Bayfield Open</div>
  </div>
  <div class="caption">{{CAPTION}}</div>
</div>
"""

if __name__ == "__main__":
    main()
