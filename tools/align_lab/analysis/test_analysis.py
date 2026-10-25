import copy

import numpy as np
import pytest

from run import mora_units, reference_metrics, snap_marks, specs, validate


def fixture():
    return {"lines": [{"line": s["line"], "morae": [
        {"k": k, "t": s["start"]+j*.05} for j, k in enumerate(s["morae"])]} for s in specs()]}


def test_contract_349_morae_and_segment_boundaries():
    assert sum(len(s["morae"]) for s in specs()) == 349
    assert specs()[5]["morae"] == ['さ','よ','な','ら','っ','て','て','を','ふ','る','た','び','に']
    assert mora_units("きっと") == ["きっ", "と"]
    assert mora_units("じゅう") == ["じゅ", "う"]
    assert validate(fixture())["morae"] == 349


@pytest.mark.parametrize("corruption", ["duplicate_line", "bad_kana", "missing", "nan", "reverse", "equal"])
def test_validation_rejects_corruption(corruption):
    d = fixture()
    marks = d["lines"][0]["morae"]
    if corruption == "duplicate_line": d["lines"][1]["line"] = 0
    if corruption == "bad_kana": marks[0]["k"] = "wrong"
    if corruption == "missing": marks.pop()
    if corruption == "nan": marks[0]["t"] = float("nan")
    if corruption == "reverse": marks[1]["t"] = marks[0]["t"]-.1
    if corruption == "equal": marks[1]["t"] = marks[0]["t"]
    with pytest.raises(ValueError): validate(d)


def test_snap_radius_and_nearest():
    result = snap_marks([1., 2., 3.], [.95, 2.08, 3.081])
    np.testing.assert_allclose(result, [.95, 2.08, 3.])


def test_snap_never_collapses_or_reorders():
    times = np.array([1., 1.02, 1.04])
    result = snap_marks(times, [1.01])
    assert np.all(np.diff(result) > 0)
    assert np.max(np.abs(result-times)) <= .080


def test_reference_score_confidence_is_explicit():
    ref = {"lines": [{"line": 0, "morae": [{"k":"a","t":1.,"conf":.3}, {"k":"b","t":2.,"conf":.8}]}]}
    d = copy.deepcopy(ref)
    d["lines"][0]["morae"][0]["t"] += 1
    assert reference_metrics(d, ref)["n"] == 2
    assert reference_metrics(d, ref, True) == {"n":1, "median_abs_ms":0., "bias_ms":0., "hit50":1., "hit100":1.}
