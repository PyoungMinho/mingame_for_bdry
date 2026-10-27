// src/lib/cloudcheck/rules/registry.ts — 룰 모듈 전체 목록(우선순위 순, 18장)
// 룰 하나 = 파일 하나. 정적 데이터(spec)와 판정 함수(evaluate)·사유 선택(explain)이 같은 파일에 있다.
import type { RuleModule } from "../engine/types";
import { AWS_KEY_1 } from "./aws/aws-key-1";
import { AWS_KEY_2 } from "./aws/aws-key-2";
import { AWS_KEY_3 } from "./aws/aws-key-3";
import { AWS_KEY_4 } from "./aws/aws-key-4";
import { AWS_LOG_1 } from "./aws/aws-log-1";
import { AWS_MFA_1 } from "./aws/aws-mfa-1";
import { AWS_MFA_2 } from "./aws/aws-mfa-2";
import { AWS_NET_1 } from "./aws/aws-net-1";
import { AWS_STO_1 } from "./aws/aws-sto-1";
import { AWS_STO_2 } from "./aws/aws-sto-2";
import { AZ_KEY_1 } from "./azure/az-key-1";
import { AZ_LOG_1 } from "./azure/az-log-1";
import { AZ_LOG_2 } from "./azure/az-log-2";
import { AZ_MFA_1 } from "./azure/az-mfa-1";
import { AZ_MFA_G } from "./azure/az-mfa-g";
import { AZ_NET_1 } from "./azure/az-net-1";
import { AZ_STO_1 } from "./azure/az-sto-1";
import { AZ_STO_2 } from "./azure/az-sto-2";

export const RULES: readonly RuleModule[] = [
  AWS_STO_2, AZ_STO_2, AWS_NET_1, AZ_NET_1, AWS_KEY_4, AWS_MFA_1, AWS_MFA_2, AZ_MFA_1, AZ_MFA_G,
  AWS_KEY_3, AWS_KEY_1, AWS_KEY_2, AZ_KEY_1, AWS_STO_1, AZ_STO_1, AWS_LOG_1, AZ_LOG_1, AZ_LOG_2,
].sort((a, b) => a.spec.priority - b.spec.priority);
