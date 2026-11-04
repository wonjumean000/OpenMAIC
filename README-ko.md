# OpenMAIC 한국어 안내

> 한국어 번역 초안입니다. 우선 주요 소개와 시작 방법을 정리했습니다. 나머지 문서와 세부 항목은 순차적으로 번역·검토할 예정입니다.

<p align="center">
  <img src="assets/banner.png" alt="OpenMAIC 배너" width="680"/>
</p>

<p align="center">클릭 한 번으로 몰입형 멀티 에이전트 학습 경험을 만나보세요.</p>

<p align="center">
  <a href="./README.md">English</a> | <a href="./README-zh.md">简体中文</a> | 한국어
</p>

## 개요

**OpenMAIC**(Open Multi-Agent Interactive Classroom)은 주제나 문서를 풍부하고 상호작용적인 교실 경험으로 바꾸는 오픈소스 AI 플랫폼입니다. 멀티 에이전트 오케스트레이션을 활용해 슬라이드, 퀴즈, 대화형 시뮬레이션, 프로젝트 기반 학습(PBL) 활동을 생성합니다. AI 교사와 학습자는 음성으로 설명하고, 화이트보드에 그림을 그리며, 실시간으로 대화할 수 있습니다.

### 주요 기능

- **수업 생성:** 주제를 설명하거나 참고 자료를 첨부하면 수업 개요와 장면을 생성합니다.
- **멀티 에이전트 교실:** AI 교사와 학습자가 강의하고 토론하며 상호작용합니다.
- **다양한 학습 장면:** 슬라이드, 퀴즈, 대화형 HTML 시뮬레이션, 프로젝트 기반 학습을 지원합니다.
- **화이트보드와 음성:** 다이어그램과 수식을 그리며 음성으로 설명할 수 있습니다.
- **내보내기:** PPTX, 오프라인 HTML, 리소스 팩, 교실 ZIP 형식으로 내보낼 수 있습니다.
- **에이전트 워크벤치:** OpenClaw, Codex, DeepSeek, WorkBuddy 등의 환경에서 수업을 만들 수 있습니다.

## 빠른 시작

### 사전 요구 사항

- Node.js 22.19 이상
- pnpm 10 이상
- PostgreSQL 16

### 설치 및 설정

```bash
git clone https://github.com/THU-MAIC/OpenMAIC.git
cd OpenMAIC
pnpm install
cp .env.example .env.local
cp openmaic.example.yml openmaic.yml
```

`.env.local`에 사용할 API 키를 설정하고, 로컬 개발용 PostgreSQL을 시작합니다.

```bash
pnpm db:up
```

`.env.local`에서 `DATABASE_URL` 설정을 활성화합니다.

```env
DATABASE_URL=postgres://openmaic:openmaic-dev@127.0.0.1:5432/openmaic
```

앱을 실행합니다.

```bash
pnpm dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 자세한 설정과 배포 방법은 [배포 문서](packages/docs/content/docs/deployment.mdx)를 참고하세요.

## 구성

`openmaic.yml`에서 서버가 사용할 공급자와 모델 슬롯을 설정합니다. API 키는 `.env.local`에 보관하고 `${환경변수명}` 형식으로 참조합니다.

```yaml
providers:
  openai:
    preset: openai
    apiKey: ${OPENAI_API_KEY}

slots:
  llm: openai:gpt-5.5
  course.outline: openai:gpt-5.5
```

공급자, 슬롯, 지원 모델, 잠금 및 사용자 키 설정은 [구성 가이드](packages/docs/content/docs/configuration.mdx)와 [지원 모델 목록](packages/docs/content/docs/supported-models.mdx)을 확인하세요.

## 배포 참고 사항

- OpenMAIC 1.2.0부터 수업 생성이 장기 실행 서버 프로세스에서 동작하므로 PostgreSQL과 지속 실행 Node.js 서버가 필요합니다.
- Docker Compose 배포 예시는 다음 명령으로 시작할 수 있습니다.

```bash
cp .env.example .env.local
docker compose up --build
```

- 네트워크에 공개하기 전에는 접근 코드와 데이터베이스 비밀번호를 설정하고, [호스팅 및 사용자 식별 문서](packages/docs/content/docs/hosting.mdx)를 확인하세요.
- 1.1.x에서 업그레이드하는 경우 데이터베이스와 배포 방식에 관한 [업그레이드 안내](packages/docs/content/docs/deployment.mdx#upgrading-from-11x)를 먼저 읽으세요.

## 문서 및 링크

- [영문 README](README.md)
- [중국어 README](README-zh.md)
- [구성 가이드](packages/docs/content/docs/configuration.mdx)
- [지원 모델](packages/docs/content/docs/supported-models.mdx)
- [배포 가이드](packages/docs/content/docs/deployment.mdx)
- [호스팅 및 사용자 식별](packages/docs/content/docs/hosting.mdx)
- [변경 로그](CHANGELOG.md)

## 라이선스

프로젝트는 MIT 라이선스를 사용합니다. 단, 일부 번들 패키지는 별도의 라이선스 조건을 적용받습니다. 전체 내용은 [라이선스 파일](LICENSE)과 각 패키지의 라이선스를 확인하세요.
