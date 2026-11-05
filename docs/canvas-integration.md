# Canvas LMS 연동

학교 Canvas LMS의 강의 자료(강의계획서, 페이지, 과제, 모듈)를 OpenMAIC 수업 생성의 입력 텍스트로 가져오는 연동입니다. 참고: [Canvas LMS API 문서](https://developerdocs.instructure.com/services/canvas)

## 설계

| 항목 | 결정 |
| --- | --- |
| 인증 | 서버 환경 변수의 액세스 토큰(Bearer 헤더). 토큰은 브라우저에 전달되지 않음 |
| 대상 | `CANVAS_BASE_URL`의 origin 하나만 호출. 다른 origin의 pagination 링크와 리다이렉트는 거부 |
| 보안 | 기존 `ssrf-guard`로 대상 검증, https 강제(`ALLOW_LOCAL_NETWORKS` 개발 예외), 요청 타임아웃 15초 |
| ID | `Accept: application/json+canvas-string-ids`로 64비트 ID를 문자열로 수신 |
| 접근 제어 | 모든 라우트가 `withRequestOwner`를 거치므로 `ACCESS_CODE`와 오너 정책이 그대로 적용 |
| 상한 | 페이지 본문 15개, 과제 50개, 전체 150,000자 (초과 시 `truncated: true`) |

## 설정

1. Canvas에서 Account > Settings > Approved Integrations > New Access Token으로 토큰을 발급합니다. 학교가 개인 토큰을 막았다면 관리자에게 Developer Key(OAuth2)를 요청하세요.
2. `.env.local`에 추가합니다.

```env
CANVAS_BASE_URL=https://yourschool.instructure.com
CANVAS_ACCESS_TOKEN=발급받은_토큰
```

3. 서버를 재시작합니다. 두 값이 모두 없으면 `/api/canvas/courses`는 404를 반환하고 `/api/canvas/status`는 `configured: false`를 반환합니다.

## API

- `GET /api/canvas/status`: 설정 여부와 토큰 유효성 확인 (토큰은 응답에 포함되지 않음)
- `GET /api/canvas/courses`: 수강/담당 중인 활성 강의 목록
- `GET /api/canvas/courses/:courseId/content?sections=syllabus,pages,assignments,modules`: 강의 자료를 Markdown으로 반환 (`sections` 생략 시 전체)

## 현재 범위와 다음 단계

이 변경은 서버 측 연동과 API까지입니다. 홈 화면에서 강의를 고르고 수업 생성 입력으로 넘기는 UI와 한국어 문구는 아직 연결하지 않았습니다.

1. 홈 생성 입력에 "Canvas에서 가져오기" 선택 UI 추가 (`/api/canvas/courses` → `/content`)
2. 사용자별 OAuth2 (`/login/oauth2/auth`, `/login/oauth2/token`): 토큰 저장 스키마가 필요하므로 `@openmaic/storage` 마이그레이션과 함께 별도 PR로 진행
3. 파일(PDF, PPTX) 가져오기: Canvas 파일 API → 기존 `/api/materials` 업로드 파이프라인
4. 연동 UI와 UI/UX 한국어 문구 개선
