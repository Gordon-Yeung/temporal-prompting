"""
Inter-rater reliability statistics for the human coding tool (Study 2).

Pure standard library — no numpy/sklearn — so the tool has one dependency (Flask).

The coding task is scene-flagging: coders flag a small number of teacher turns
out of many. That makes the flagged/not-flagged distribution extremely skewed,
which deflates Cohen's kappa (the "kappa paradox"). We therefore report several
complementary numbers and let the researcher read them together:

  - raw agreement            intuitive but inflated by the many shared "none"s
  - Cohen's kappa            chance-corrected, but pessimistic on rare events
  - PABAK                    prevalence-and-bias-adjusted kappa (2*po - 1)
  - positive agreement       Dice/F1 on the flags themselves (ignores shared "none")
  - negative agreement       agreement on the shared "none"s
  - category Jaccard         given both flagged a turn, how much categories overlap
"""

from typing import Dict, List, Set


def binary_agreement(a_turns: Set[int], b_turns: Set[int], universe_n: int) -> Dict:
    """
    Agreement on the binary decision "is this teacher turn flagged?".

    a_turns / b_turns : sets of turn numbers each coder flagged.
    universe_n        : total number of codeable (teacher) turns.
    """
    both = len(a_turns & b_turns)
    a_only = len(a_turns - b_turns)
    b_only = len(b_turns - a_turns)
    # Guard: universe should cover every flagged turn even if a flag somehow
    # landed on a turn not counted as teacher; never let "neither" go negative.
    neither = max(universe_n - both - a_only - b_only, 0)
    n = both + a_only + b_only + neither

    if n == 0:
        return {
            "both": 0, "a_only": 0, "b_only": 0, "neither": 0, "n": 0,
            "raw_agreement": None, "cohen_kappa": None, "pabak": None,
            "positive_agreement": None, "negative_agreement": None,
        }

    po = (both + neither) / n

    a_pos = (both + a_only) / n
    b_pos = (both + b_only) / n
    pe = (a_pos * b_pos) + ((1 - a_pos) * (1 - b_pos))

    kappa = None if (1 - pe) == 0 else (po - pe) / (1 - pe)
    pabak = 2 * po - 1

    pos_denom = 2 * both + a_only + b_only
    positive_agreement = None if pos_denom == 0 else (2 * both) / pos_denom
    neg_denom = 2 * neither + a_only + b_only
    negative_agreement = None if neg_denom == 0 else (2 * neither) / neg_denom

    return {
        "both": both, "a_only": a_only, "b_only": b_only, "neither": neither, "n": n,
        "raw_agreement": po,
        "cohen_kappa": kappa,
        "pabak": pabak,
        "positive_agreement": positive_agreement,
        "negative_agreement": negative_agreement,
    }


def category_agreement(a_cats: Dict[int, Set[str]], b_cats: Dict[int, Set[str]]) -> Dict:
    """
    Category-level agreement, conditioned on turns BOTH coders flagged.

    a_cats / b_cats : turn number -> set of category codes (A-G, "Other").
    Returns mean Jaccard over shared turns plus a per-category both/only tally
    across the union of all flagged turns.
    """
    shared = set(a_cats) & set(b_cats)
    jaccards: List[float] = []
    for t in shared:
        sa, sb = a_cats[t], b_cats[t]
        union = sa | sb
        jaccards.append(1.0 if not union else len(sa & sb) / len(union))
    mean_jaccard = sum(jaccards) / len(jaccards) if jaccards else None

    all_cats = ["A", "B", "C", "D", "E", "F", "G", "Other"]
    per_category = {}
    union_turns = set(a_cats) | set(b_cats)
    for c in all_cats:
        both = a_only = b_only = 0
        for t in union_turns:
            in_a = c in a_cats.get(t, set())
            in_b = c in b_cats.get(t, set())
            if in_a and in_b:
                both += 1
            elif in_a:
                a_only += 1
            elif in_b:
                b_only += 1
        if both or a_only or b_only:
            per_category[c] = {"both": both, "a_only": a_only, "b_only": b_only}

    return {
        "shared_turns": len(shared),
        "mean_jaccard": mean_jaccard,
        "per_category": per_category,
    }
