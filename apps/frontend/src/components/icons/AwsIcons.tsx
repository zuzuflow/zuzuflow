import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

// =============================================================================
// AWS Lambda — function/compute icon
// =============================================================================
export function AwsLambdaIcon({ size = 14, className }: IconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.3 36H5.4L16.7 4H24L14.3 36Z" fill="white" fillOpacity="0.9"/>
      <path d="M27.2 36H18.6L23.5 22.8L28.1 32.4L27.2 36Z" fill="white" fillOpacity="0.9"/>
      <path d="M34.6 36H29.3L23.5 22.8L27.4 12H32.7L34.6 36Z" fill="white" fillOpacity="0.6"/>
    </svg>
  );
}

// =============================================================================
// AWS SQS — queue/message icon
// =============================================================================
export function AwsSqsIcon({ size = 14, className }: IconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 6C12.3 6 6 11.4 6 18C6 21.5 7.8 24.6 10.7 26.7L9.5 32L15.5 29.2C16.9 29.7 18.4 30 20 30C27.7 30 34 24.6 34 18C34 11.4 27.7 6 20 6Z" fill="white" fillOpacity="0.9"/>
      <circle cx="13" cy="18" r="2" fill="currentColor" opacity="0.5"/>
      <circle cx="20" cy="18" r="2" fill="currentColor" opacity="0.5"/>
      <circle cx="27" cy="18" r="2" fill="currentColor" opacity="0.5"/>
    </svg>
  );
}

// =============================================================================
// AWS SNS — notification/megaphone icon
// =============================================================================
export function AwsSnsIcon({ size = 14, className }: IconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 5C18.5 5 17 6.5 17 8V22C17 23.5 18.5 25 20 25C21.5 25 23 23.5 23 22V8C23 6.5 21.5 5 20 5Z" fill="white" fillOpacity="0.9"/>
      <path d="M12 14L7 11V23L12 20V14Z" fill="white" fillOpacity="0.6"/>
      <path d="M28 14L33 11V23L28 20V14Z" fill="white" fillOpacity="0.6"/>
      <circle cx="20" cy="31" r="4" fill="white" fillOpacity="0.9"/>
    </svg>
  );
}

// =============================================================================
// AWS DynamoDB — table/database icon
// =============================================================================
export function AwsDynamoDBIcon({ size = 14, className }: IconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="20" cy="10" rx="14" ry="5" fill="white" fillOpacity="0.9"/>
      <path d="M6 10V30C6 32.8 12.3 35 20 35C27.7 35 34 32.8 34 30V10" stroke="white" strokeWidth="2" strokeOpacity="0.9" fill="none"/>
      <ellipse cx="20" cy="20" rx="14" ry="5" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.5"/>
      <ellipse cx="20" cy="30" rx="14" ry="5" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.5"/>
    </svg>
  );
}

// =============================================================================
// AWS SES — email icon
// =============================================================================
export function AwsSesIcon({ size = 14, className }: IconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="10" width="30" height="22" rx="2" fill="white" fillOpacity="0.9"/>
      <path d="M5 12L20 23L35 12" stroke="currentColor" strokeWidth="2" opacity="0.4"/>
    </svg>
  );
}

// =============================================================================
// AWS Secrets Manager — key/lock icon
// =============================================================================
export function AwsSecretsManagerIcon({ size = 14, className }: IconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="9" fill="none" stroke="white" strokeWidth="2.5" strokeOpacity="0.9"/>
      <circle cx="16" cy="16" r="3.5" fill="white" fillOpacity="0.6"/>
      <rect x="22" y="14" width="14" height="4" rx="1" fill="white" fillOpacity="0.9"/>
      <rect x="30" y="18" width="4" height="6" rx="1" fill="white" fillOpacity="0.7"/>
      <rect x="24" y="18" width="4" height="4" rx="1" fill="white" fillOpacity="0.7"/>
    </svg>
  );
}

// =============================================================================
// AWS SSM — parameter/settings gear icon
// =============================================================================
export function AwsSsmIcon({ size = 14, className }: IconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 6L22 10H18L20 6ZM34 20L30 22V18L34 20ZM20 34L18 30H22L20 34ZM6 20L10 18V22L6 20Z" fill="white" fillOpacity="0.6"/>
      <path d="M29 11L26.5 14.5L25.5 13.5L29 11ZM29 29L25.5 26.5L26.5 25.5L29 29ZM11 29L13.5 25.5L14.5 26.5L11 29ZM11 11L14.5 13.5L13.5 14.5L11 11Z" fill="white" fillOpacity="0.6"/>
      <circle cx="20" cy="20" r="7" fill="none" stroke="white" strokeWidth="2.5" strokeOpacity="0.9"/>
      <circle cx="20" cy="20" r="3" fill="white" fillOpacity="0.9"/>
    </svg>
  );
}

// =============================================================================
// AWS EventBridge — event bus / lightning bolt icon
// =============================================================================
export function AwsEventBridgeIcon({ size = 14, className }: IconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 8H18V18H8V8Z" fill="white" fillOpacity="0.7" rx="2"/>
      <path d="M22 8H32V18H22V8Z" fill="white" fillOpacity="0.7" rx="2"/>
      <path d="M8 22H18V32H8V22Z" fill="white" fillOpacity="0.7" rx="2"/>
      <path d="M22 22H32V32H22V22Z" fill="white" fillOpacity="0.7" rx="2"/>
      <path d="M18 13H22M20 18V22M18 27H22" stroke="white" strokeWidth="2" strokeOpacity="0.9"/>
    </svg>
  );
}

// =============================================================================
// AWS Step Functions — state machine / workflow icon
// =============================================================================
export function AwsStepFunctionsIcon({ size = 14, className }: IconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="10" r="4" fill="white" fillOpacity="0.9"/>
      <circle cx="28" cy="20" r="4" fill="white" fillOpacity="0.9"/>
      <circle cx="12" cy="30" r="4" fill="white" fillOpacity="0.9"/>
      <path d="M16 10H24L28 16" stroke="white" strokeWidth="2" strokeOpacity="0.7"/>
      <path d="M28 24L24 30H16" stroke="white" strokeWidth="2" strokeOpacity="0.7"/>
    </svg>
  );
}

// =============================================================================
// AWS S3 — bucket icon
// =============================================================================
export function AwsS3Icon({ size = 14, className }: IconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="20" cy="8" rx="12" ry="4" fill="white" fillOpacity="0.9"/>
      <path d="M8 8V32C8 34.2 13.4 36 20 36C26.6 36 32 34.2 32 32V8" stroke="white" strokeWidth="2" strokeOpacity="0.9" fill="none"/>
      <path d="M8 20C8 22.2 13.4 24 20 24C26.6 24 32 22.2 32 20" stroke="white" strokeWidth="1.5" strokeOpacity="0.5"/>
    </svg>
  );
}
