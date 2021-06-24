

배포시 주의사항
1. `fromEcrRepository()`를 사용해서 ECS Service를 생성하는 경우 ECR Repository 에 이미 이미지가 존재하는 상태여야 합니다.
2. Secrets Manager 를 통해 Secret을 관리하는 경우, 이것을 코드화할 지 생각해보아야 합니다.