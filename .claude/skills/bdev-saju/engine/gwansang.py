#!/usr/bin/env python3
"""
관상 측정 엔진 (gwansang.py)

정면 얼굴 사진 1장 → MediaPipe Face Landmarker(478점)로 얼굴 비율을 재서
삼정·오관·얼굴형 오행을 "등급"으로 돌려준다. 해석은 하지 않는다.
해석은 references/gwansang.md 규칙으로 LLM이 쓴다 (사주의 manse.cjs ↔ interpretation.md 구조와 동일).

사용:
  python3 gwansang.py 사진.jpg            # 사람이 읽는 요약
  python3 gwansang.py 사진.jpg --json     # 해석용 JSON

사진은 메모리에서만 읽고 어디에도 저장하지 않는다.
"""
import json
import math
import os
import sys
import urllib.request

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/1/face_landmarker.task"
)
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "face_landmarker.task")

# MediaPipe Face Mesh 랜드마크 번호 (정면 기준, 사진의 왼쪽 = 본인의 오른쪽)
LM = {
    "forehead_top": 10,      # 얼굴 메쉬 최상단 (발제선보다 약간 아래)
    "glabella": 9,           # 미간(인당) 높이
    "nose_tip": 1,           # 코끝(준두)
    "subnasale": 2,          # 코밑(인중 시작)
    "upper_lip_top": 0,      # 윗입술 위
    "upper_lip_bottom": 13,
    "lower_lip_top": 14,
    "lower_lip_bottom": 17,
    "chin": 152,             # 턱끝
    "cheek_r": 234, "cheek_l": 454,          # 광대 폭
    "forehead_r": 54, "forehead_l": 284,     # 이마 폭
    "jaw_r": 172, "jaw_l": 397,              # 턱각(하악각) 부근 폭
    "chin_r": 176, "chin_l": 400,            # 턱끝 양옆 폭
    "eye_r_out": 33, "eye_r_in": 133, "eye_r_top": 159, "eye_r_bot": 145,
    "eye_l_out": 263, "eye_l_in": 362, "eye_l_top": 386, "eye_l_bot": 374,
    "brow_r_in": 55, "brow_r_out": 46, "brow_r_mid": 105,
    "brow_l_in": 285, "brow_l_out": 276, "brow_l_mid": 334,
    "nose_wing_r": 129, "nose_wing_l": 358,  # 콧방울 폭
    "mouth_r": 61, "mouth_l": 291,
}


def ensure_model():
    if os.path.exists(MODEL_PATH):
        return
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    tmp = MODEL_PATH + ".part"
    urllib.request.urlretrieve(MODEL_URL, tmp)
    os.replace(tmp, MODEL_PATH)


def detect(image_path):
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision

    ensure_model()
    options = vision.FaceLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=MODEL_PATH),
        num_faces=5,
    )
    with vision.FaceLandmarker.create_from_options(options) as landmarker:
        image = mp.Image.create_from_file(image_path)
        result = landmarker.detect(image)
    if not result.face_landmarks:
        return None, 0, (image.width, image.height)
    # 여러 명이면 가장 큰 얼굴
    faces = result.face_landmarks
    def area(f):
        xs = [p.x for p in f]; ys = [p.y for p in f]
        return (max(xs) - min(xs)) * (max(ys) - min(ys))
    face = max(faces, key=area)
    return face, len(faces), (image.width, image.height)


def grade(value, low, high, words=("작음", "보통", "큼")):
    if value < low:
        return words[0]
    if value > high:
        return words[2]
    return words[1]


def measure(face, size):
    w, h = size
    P = {k: (face[i].x * w, face[i].y * h) for k, i in LM.items()}

    def d(a, b):
        return math.dist(P[a], P[b])

    def dy(a, b):
        return abs(P[a][1] - P[b][1])

    def angle(inner, outer, flip):
        # 눈꼬리 각도: 바깥쪽이 올라가면 +
        (xi, yi), (xo, yo) = P[inner], P[outer]
        deg = math.degrees(math.atan2(yi - yo, abs(xo - xi)))
        return deg

    warnings = []

    # ── 정면 여부 (코끝이 양 광대 가운데에 있는지)
    left = abs(P["nose_tip"][0] - P["cheek_r"][0])
    right = abs(P["cheek_l"][0] - P["nose_tip"][0])
    yaw_ratio = min(left, right) / max(left, right)
    if yaw_ratio < 0.8:
        warnings.append("얼굴이 옆으로 돌아가 있어 좌우 비율 측정이 부정확합니다. 정면 사진을 권장합니다.")
    roll = math.degrees(math.atan2(P["eye_l_out"][1] - P["eye_r_out"][1], P["eye_l_out"][0] - P["eye_r_out"][0]))
    if abs(roll) > 8:
        warnings.append("고개가 기울어져 있습니다. 눈꼬리 각도 판정이 흔들릴 수 있습니다.")

    # ── 삼정 (상정: 메쉬 최상단~미간 / 중정: 미간~코밑 / 하정: 코밑~턱끝)
    upper = dy("forehead_top", "glabella")
    middle = dy("glabella", "subnasale")
    lower = dy("subnasale", "chin")
    total = upper + middle + lower
    samjeong = {
        "상정": round(upper / total * 100),
        "중정": round(middle / total * 100),
        "하정": round(lower / total * 100),
    }
    # MediaPipe 최상단(10번)은 발제선보다 아래라 상정이 실제보다 짧게 잡힌다 → 기준을 낮춰 둔다.
    # 아래 등급 기준값들은 전부 MediaPipe 메쉬 좌표계 기준이다(실측 cm 비율과 다름).
    samjeong_grade = {
        "상정": grade(samjeong["상정"], 18, 24, ("짧음", "보통", "김")),
        "중정": grade(samjeong["중정"], 34, 40, ("짧음", "보통", "김")),
        "하정": grade(samjeong["하정"], 37, 44, ("짧음", "보통", "김")),
    }
    # 상정은 메쉬 때문에 늘 짧게 잡히므로, 원값이 아니라 각 구간의 "보통" 중간값 대비로 가장 긴 곳을 고른다
    mid = {"상정": 21, "중정": 37, "하정": 40.5}
    longest = max(samjeong, key=lambda k: samjeong[k] - mid[k])

    # ── 얼굴형
    face_len = dy("forehead_top", "chin")
    cheek_w = d("cheek_r", "cheek_l")
    forehead_w = d("forehead_r", "forehead_l")
    jaw_w = d("jaw_r", "jaw_l")
    chin_w = d("chin_r", "chin_l")
    ratios = {
        "길이_광대폭": face_len / cheek_w,
        "이마폭_광대폭": forehead_w / cheek_w,
        "턱폭_광대폭": jaw_w / cheek_w,
        "턱끝폭_턱폭": chin_w / jaw_w,
    }
    L, F, J, C = (ratios["길이_광대폭"], ratios["이마폭_광대폭"], ratios["턱폭_광대폭"], ratios["턱끝폭_턱폭"])
    # 오행형 점수 (높을수록 해당 형에 가까움). 규칙 근거는 references/gwansang.md
    scores = {
        "목형": (L - 1.0) * 4 - abs(F - J) * 2,              # 길쭉, 위아래 폭이 비슷
        "화형": (F - J) * 6 + (0.42 - C) * 4,                # 이마 넓고 턱이 뾰족 (역삼각)
        "토형": (J - 0.80) * 6 + (1.05 - L) * 3 + (C - 0.42) * 2,  # 턱이 넓고 두툼, 짧은 편
        "금형": (J - 0.78) * 5 + (1 - abs(L - 1.15) * 4) + (C - 0.42) * 2 - abs(F - J) * 2,  # 각지고 반듯
        "수형": (1.05 - L) * 4 + (0.55 - abs(C - 0.45)) - abs(F - J) * 2 + (0.85 - J) * 2,  # 둥글고 짧음
    }
    ranked = sorted(scores, key=scores.get, reverse=True)

    # ── 눈
    eye_w = (d("eye_r_out", "eye_r_in") + d("eye_l_out", "eye_l_in")) / 2
    eye_h = (d("eye_r_top", "eye_r_bot") + d("eye_l_top", "eye_l_bot")) / 2
    eye_gap = d("eye_r_in", "eye_l_in")
    tilt = (angle("eye_r_in", "eye_r_out", 1) + angle("eye_l_in", "eye_l_out", -1)) / 2
    eye = {
        "눈_크기": grade(eye_w / cheek_w, 0.18, 0.22, ("작음", "보통", "큼")),
        "눈_세로": grade(eye_h / eye_w, 0.28, 0.40, ("가늘다", "보통", "둥글다")),
        "눈_사이": grade(eye_gap / eye_w, 1.05, 1.4, ("좁음", "보통", "넓음")),
        "눈꼬리": grade(tilt, -2, 4, ("처짐", "수평", "올라감")),
    }

    # ── 눈썹
    brow_eye = (dy("brow_r_mid", "eye_r_top") + dy("brow_l_mid", "eye_l_top")) / 2
    brow_len = (d("brow_r_in", "brow_r_out") + d("brow_l_in", "brow_l_out")) / 2
    indang = d("brow_r_in", "brow_l_in")
    brow = {
        "눈썹_길이": grade(brow_len / eye_w, 1.35, 1.75, ("짧음", "보통", "김")),
        "눈썹_눈_간격(전택궁)": grade(brow_eye / eye_w, 0.45, 0.7, ("좁음", "보통", "넓음")),
        "미간(인당)": grade(indang / eye_w, 0.8, 1.2, ("좁음", "보통", "넓음")),
    }

    # ── 코
    nose_w = d("nose_wing_r", "nose_wing_l")
    nose = {
        "코_길이": grade(middle / face_len, 0.30, 0.36, ("짧음", "보통", "김")),
        "콧방울_폭": grade(nose_w / eye_gap, 1.1, 1.45, ("좁음", "보통", "넓음")),
    }

    # ── 입·인중·턱
    mouth_w = d("mouth_r", "mouth_l")
    lip_up = d("upper_lip_top", "upper_lip_bottom")
    lip_low = d("lower_lip_top", "lower_lip_bottom")
    philtrum = d("subnasale", "upper_lip_top")
    mouth = {
        "입_크기": grade(mouth_w / nose_w, 1.3, 1.6, ("작음", "보통", "큼")),
        "입술_두께": grade((lip_up + lip_low) / mouth_w, 0.25, 0.4, ("얇음", "보통", "두툼")),
        "인중_길이": grade(philtrum / lower, 0.15, 0.25, ("짧음", "보통", "김")),
        "턱": grade(C, 0.35, 0.5, ("뾰족", "보통", "넓고 두툼")),
    }

    # ── 좌우 대칭
    mid_x = (P["glabella"][0] + P["chin"][0]) / 2
    pairs = [("eye_r_out", "eye_l_out"), ("cheek_r", "cheek_l"), ("mouth_r", "mouth_l"), ("jaw_r", "jaw_l")]
    asym = sum(abs(abs(P[a][0] - mid_x) - abs(P[b][0] - mid_x)) for a, b in pairs) / (len(pairs) * cheek_w)
    symmetry = grade(asym, 0.02, 0.05, ("좋음", "보통", "치우침"))

    return {
        "warnings": warnings,
        "samjeong": {"percent": samjeong, "grade": samjeong_grade, "longest": longest},
        "faceShape": {
            "ohaeng": ranked[0],
            "secondary": ranked[1],
            "ranking": ranked,
            "ratios": {k: round(v, 2) for k, v in ratios.items()},
        },
        "eyes": eye,
        "brows": brow,
        "nose": nose,
        "mouth": mouth,
        "symmetry": symmetry,
        "notMeasured": ["귀(정면 사진에서 측정 불가)", "피부색·기색", "점·주름", "상정의 발제선(메쉬가 이마 끝까지 닿지 않음)"],
    }


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    as_json = "--json" in argv
    if not args:
        print(__doc__.strip())
        return 1
    path = args[0]
    if not os.path.exists(path):
        print(f"사진 파일을 찾을 수 없습니다: {path}", file=sys.stderr)
        return 1

    face, count, size = detect(path)
    if face is None:
        out = {"ok": False, "error": "얼굴을 찾지 못했습니다. 정면·밝은 조명 사진으로 다시 시도하세요."}
        print(json.dumps(out, ensure_ascii=False, indent=2) if as_json else out["error"])
        return 2

    data = measure(face, size)
    if count > 1:
        data["warnings"].append(f"얼굴이 {count}개 감지되어 가장 큰 얼굴 하나만 분석했습니다.")
    out = {"ok": True, "faces": count, "result": data}

    if as_json:
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0

    r = data
    print("■ 관상 측정 결과")
    for w in r["warnings"]:
        print(f"  ⚠ {w}")
    s = r["samjeong"]
    print(f"\n[삼정] 상정 {s['grade']['상정']} / 중정 {s['grade']['중정']} / 하정 {s['grade']['하정']} → 가장 긴 곳: {s['longest']}")
    fs = r["faceShape"]
    print(f"[얼굴형] {fs['ohaeng']} (다음: {fs['secondary']})")
    for part in ("eyes", "brows", "nose", "mouth"):
        print("  " + " / ".join(f"{k} {v}" for k, v in r[part].items()))
    print(f"[좌우 대칭] {r['symmetry']}")
    print(f"\n측정 안 됨: {', '.join(r['notMeasured'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
