/**
 * 서버 시각 보정. 응답마다 `serverNow`와 요청 왕복 시간을 받아, 왕복이 가장 짧았던 표본의 오프셋을 쓴다.
 * now() = 로컬 시각 + 오프셋. 카운트다운·기한 비교에만 쓴다(컨트롤러 규칙 5).
 * 최소 왕복 값은 표본마다 조금씩 늘려(시계 흐름·네트워크 변화에 적응) 오래된 표본이 영원히 이기지 않게 한다.
 */
export class ServerClock {
  private offset = 0;
  private bestRtt = Infinity;
  constructor(private readonly local: () => number = () => Date.now()) {}

  /** sentAt/receivedAt = 로컬 시각 ms. 왕복 절반을 보정한 서버 시각과의 차이를 표본으로 삼는다 */
  sample(serverNow: number, sentAt: number, receivedAt: number): void {
    const rtt = Math.max(0, receivedAt - sentAt);
    if (rtt <= this.bestRtt) {
      this.offset = serverNow + rtt / 2 - receivedAt;
      this.bestRtt = rtt;
    } else {
      this.bestRtt += 5;
    }
  }

  now(): number {
    return this.local() + this.offset;
  }

  get offsetMs(): number {
    return this.offset;
  }
}
