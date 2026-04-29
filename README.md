# 1학년 11반 반티 주문 확인 (MVP)

학생이 **학번**을 입력하면 본인 반티 주문 내역만 확인하는 웹앱입니다.

## 구성 (A안)
- 정적 프론트엔드: `index.html`, `styles.css`, `app.js`
- API: Google Apps Script Web App (`gas/Code.gs`)
- 데이터 저장: Google Sheet `students_normalized` 시트

## 보안/개인정보 보호 원칙
- 클라이언트(브라우저)에 **전체 학생 데이터**를 내려보내지 않습니다.
- API는 `studentId` 기준으로 **단일 학생 데이터만 반환**합니다.
- 관리자용 전체 조회 API/화면은 제공하지 않습니다.

> ⚠️ **MVP 한계**: 현재 버전은 학번 단독 조회입니다. 학번만 알면 조회될 수 있어 보안이 약합니다.
> 차기 버전에서 `studentId + 2차 확인값(이름/생년월일 뒤 4자리/개인코드)` 방식으로 확장하세요.

## Google Sheet 스키마
시트명: `students_normalized`

헤더(1행):
- `studentId`
- `name`
- `top_size`
- `top_sleeve`
- `top_number`
- `top_initial`
- `bottom_ordered`
- `bottom_option`
- `bottom_size`
- `cost_top`
- `cost_bottom`
- `cost_number`
- `cost_initial`
- `cost_total`
- `warnings`

`warnings`는 다건일 경우 `|` 문자로 구분합니다.

## Apps Script 배포
1. 구글 스프레드시트 준비 후 `students_normalized` 시트 생성
2. 확장 프로그램 > Apps Script 열기
3. `gas/Code.gs` 내용 복사
4. `SPREADSHEET_ID`를 실제 시트 ID로 수정
5. 배포 > 새 배포 > 웹 앱
   - 실행 사용자: 나
   - 접근 권한: 링크가 있는 모든 사용자
6. 발급된 `/exec` URL을 `app.js`의 `API_BASE_URL`에 설정

## 프론트엔드 실행
정적 파일이므로 간단한 서버로 실행:

```bash
python3 -m http.server 8080
```

브라우저에서 `http://localhost:8080` 접속

## 응답 status
- `FOUND`: 정상 조회
- `NO_ORDER`: 학생은 있으나 주문 미응답/미완성
- `NOT_FOUND`: 학번 없음
- `INVALID_REQUEST`: 요청 오류
- `SERVER_ERROR`: 서버 오류


## 개선 사항 (v2)
- API URL 미설정 시 프론트에서 즉시 오류 안내를 표시합니다.
- 조회 중 중복 요청 방지를 위해 버튼 비활성화/로딩 텍스트를 적용했습니다.
- API 응답 스키마를 검증하여 비정상 응답 처리 안정성을 높였습니다.
- Apps Script에서 `doPost`를 추가해 향후 2차 확인값 확장을 쉽게 했습니다.
