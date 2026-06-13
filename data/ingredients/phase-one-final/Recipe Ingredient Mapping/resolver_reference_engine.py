"""
Garnish reference resolver (v2).
Transparent matcher built ONLY from the approved 1008 quarantined dictionary's
declared surfaces + embedded normalizationRules + ambiguity policy.
NOT the production engine. Measures DICTIONARY COVERAGE. Creates no ingredientId.
"""
import json, re, unicodedata, collections

FA_DIGITS="۰۱۲۳۴۵۶۷۸۹"; AR_DIGITS="٠١٢٣٤٥٦٧٨٩"
DMAP={ord(d):str(i) for i,d in enumerate(FA_DIGITS)}; DMAP.update({ord(d):str(i) for i,d in enumerate(AR_DIGITS)})

UNIT=set("""cup cups tbsp tbsps tablespoon tablespoons tsp tsps teaspoon teaspoons g gr gram grams kg kgs
kilogram kilograms mg ml l liter liters litre litres oz ounce ounces lb lbs pound pounds pinch pinches
dash dashes clove cloves slice slices can cans tin tins package packages packet packets pack bunch bunches
handful handfuls sprig sprigs stalk stalks stick sticks piece pieces sheet sheets jar jars bottle bottles
drop drops thumb knob head heads
پیمانه قاشق غذاخوری چایخوری چای خوری گرم کیلو کیلوگرم میلی لیتر لیوان فنجان عدد حبه بسته قوطی مشت دسته شاخه
ورق برگ تکه قالب حلقه پر بند""".split())
QFILL=set("""of a an the to taste optional about approx approximately around some few little for garnish
از یک دو سه چهار پنج شش هفت هشت نه ده نیم نصف چند کمی مقداری مقدار حدود تقریبا به اندازه کافی لازم دلخواه
اختیاری حسب برای تزیین""".split())
PREP=set("""chopped finely diced minced grated sliced peeled cooked boiled fried drained rinsed shredded crushed
ground roasted toasted melted softened cubed halved quartered trimmed deboned skinless boneless raw fresh
dried large small medium ripe beaten whisked thinly thickly julienned mashed hearts juiced leaves
خرد رنده شده اب پز پز سرخ پوست کنده له کوبیده اسیاب پودر برشته تفت داده گرفته بدون استخوان پاک شسته صاف
حلقه نگینی ریز درشت رسیده تازه متوسط بزرگ کوچک خورشتی رنده‌شده خردشده""".split())
SPLIT_RE=re.compile(r"\s+و\s+|\s+and\s+|\s*&\s*|\s*\+\s*|\s*،\s*")

def normalize(text, lower=True):
    if text is None: return ""
    s=str(text).translate(DMAP)
    s=s.replace("ي","ی").replace("ك","ک").replace("ة","ه").replace("\u0640","")
    s=re.sub(r"[\u064B-\u0652\u0670]","",s)
    s=s.replace("\u200c"," ").replace("\u200f"," ").replace("\u200e"," ")
    s=re.sub(r"[-–—_/,،;:]"," ",s)
    s=unicodedata.normalize("NFKD",s); s="".join(c for c in s if not unicodedata.combining(c))
    if lower: s=s.lower()
    return re.sub(r"\s+"," ",s).strip()

def extract(raw):
    s=re.sub(r"\([^)]*\)"," ",raw); s=re.sub(r"（[^）]*）"," ",s)
    s=normalize(s)
    s=re.sub(r"[½¼¾⅓⅔⅛]"," ",s)
    s=re.sub(r"\b\d+\s*\d*\b"," ",s)
    toks=[t for t in s.split() if t and t not in UNIT and t not in QFILL]
    return " ".join(toks).strip()

def strip_prep(p): return " ".join(t for t in p.split() if t not in PREP).strip()

class Resolver:
    BASE={"recipeInputAliases":0.97,"canonical":0.95,"aliases":0.92,"searchKeywords":0.72}
    def __init__(self, wrapper_path):
        W=json.load(open(wrapper_path,encoding="utf-8")); self.ing=W["ingredients"]
        self.code={r["ingredientId"]:r["code"] for r in self.ing}
        L=["fa","en","ar","tr","de","fr"]
        self.M={k:collections.defaultdict(set) for k in ["RIA","ALI","CAN","KEY","TYP"]}
        for r in self.ing:
            iid=r["ingredientId"]; nm=r.get("names",{}) or {}
            for l in L:
                n=nm.get(l,{}) or {}
                for f in ("canonical","normalized","display"):
                    if n.get(f): self.M["CAN"][normalize(n[f])].add(iid)
                for a in (r.get("aliases",{}) or {}).get(l,[]) or []: self.M["ALI"][normalize(a)].add(iid)
                for a in (r.get("recipeInputAliases",{}) or {}).get(l,[]) or []: self.M["RIA"][normalize(a)].add(iid)
                for k in (r.get("searchKeywords",{}) or {}).get(l,[]) or []: self.M["KEY"][normalize(k)].add(iid)
            for t in (r.get("commonTypos",{}) or {}).get("fa",[]) or []: self.M["TYP"][normalize(t)].add(iid)
        self.policy={}
        for e in (W.get("ambiguousIngredientReviewList") or [])+(W.get("persianCulinaryAmbiguousTerms") or []):
            self.policy[normalize(e.get("term"))]=e

    def _tier(self, surface):
        for tier,key in (("recipeInputAliases","RIA"),("aliases","ALI"),("canonical","CAN"),("searchKeywords","KEY")):
            if surface in self.M[key]: return tier,self.M[key][surface]
        if surface in self.M["TYP"]: return "aliases",self.M["TYP"][surface]
        return None,set()

    def _match_surface(self, surface):
        for att,surf in enumerate((surface,strip_prep(surface))):
            if not surf: continue
            if surf in self.policy:
                p=self.policy[surf]; did=p.get("defaultIngredientId"); conf=p.get("defaultConfidence",0.6)
                if p.get("ambiguityLevel")=="high": conf=min(conf,0.92)
                return {"matchedIngredientId":did,"matchedCode":self.code.get(did),
                        "confidence":conf if did else 0.5,"matchSource":"ambiguousPolicy",
                        "needsReview":bool(p.get("requiresContextForHighConfidence",True)),
                        "reviewReason":"ambiguous_term_policy_default"+("" if did else "_no_default")}
            tier,ids=self._tier(surf)
            if tier:
                pen=0.05*att
                if len(ids)==1:
                    iid=next(iter(ids)); conf=round(max(0.0,self.BASE[tier]-pen),2)
                    return {"matchedIngredientId":iid,"matchedCode":self.code.get(iid),"confidence":conf,
                            "matchSource":tier,"needsReview":(tier=="searchKeywords") or conf<0.8 or att>0,
                            "reviewReason":("matched_via_searchKeyword" if tier=="searchKeywords" else
                                            ("matched_after_prep_strip" if att else ""))}
                cands=sorted(self.code.get(i,i) for i in ids)
                return {"matchedIngredientId":None,"matchedCode":None,"confidence":0.4,"matchSource":"unresolved",
                        "needsReview":True,"reviewReason":"ambiguous_multiple_candidates:"+",".join(cands[:6])}
        return None

    def resolve(self, raw):
        ext=extract(raw)
        out={"extractedIngredientText":ext,"normalizedIngredientText":ext,"matchedIngredientId":None,
             "matchedCode":None,"confidence":0.0,"matchSource":"unresolved","needsReview":True,
             "reviewReason":"not_in_dictionary","compound":False}
        segs=[s for s in SPLIT_RE.split(ext) if s.strip()]
        out["compound"]=len(segs)>1
        for seg in (segs or [ext]):
            m=self._match_surface(seg.strip())
            if m and m["matchedIngredientId"]:
                out.update(m)
                if out["compound"]:
                    out["needsReview"]=True
                    out["reviewReason"]=(out["reviewReason"]+";compound_line_first_match").strip(";")
                return out
            if m and not out.get("_held"):
                out.update({k:m[k] for k in ("confidence","matchSource","needsReview","reviewReason")})
                out["_held"]=True
        out.pop("_held",None)
        return out
