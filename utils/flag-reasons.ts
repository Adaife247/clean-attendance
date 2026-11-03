export type FlagCode =
  // Proxy (registration + check-in)
  | 'DUPLICATE_HARDWARE'        // This phone was used by another student
  | 'DUPLICATE_CREDENTIAL'      // This passkey belongs to another account
  | 'SYNCED_PASSKEY'            // Passkey appears synced from another device
  | 'SAME_DEVICE_TODAY'         // Phone used by a different student today
  
  // Spoofing (location)
  | 'LOCATION_SPOOF_SUSPECTED'  // GPS behaviour inconsistent with physical presence
  | 'MOTION_MISMATCH'           // Phone's motion sensor contradicts GPS
  | 'REMOTE_CHECKIN'            // Outside campus network while claiming in-hall
  | 'GPS_WEAK'                  // Accuracy too poor to verify
  | 'OUT_OF_BOUNDS'             // GPS shows you are outside the geofence
  
  // Technical (non-punitive)
  | 'NO_BIOMETRIC'              // Check-in attempted without fingerprint/FaceID
  | 'AMBIGUOUS_COLLISION'       // Possible identical-phone match; needs human eye
  | 'OFFLINE_QUEUED'            // Saved locally; will sync
  | 'ALREADY_VERIFIED'          // Student already checked in
  
  // Manual / rep
  | 'BATTERY_DEAD'              // Class rep logged this
  | 'HAND_RAISE'                // Student requested manual verification
  | 'MANUAL_OVERRIDE';          // Lecturer approved manually

export type FlagCategory = 'proxy' | 'spoof' | 'technical' | 'manual';
export type FlagSeverity = 'info' | 'warning' | 'error';
export type SuggestedAction = 'retry' | 'wait' | 'see_lecturer' | 'ask_rep' | 'contact_support' | 'none';

export interface FlagReason {
  code: FlagCode;
  severity: FlagSeverity;
  messageStudent: string;
  messageLecturer: string;
  suggestedAction: SuggestedAction;
  category: FlagCategory;
}

export const FLAG_REASONS: Record<FlagCode, FlagReason> = {
  DUPLICATE_HARDWARE: {
    code: 'DUPLICATE_HARDWARE',
    severity: 'error',
    category: 'proxy',
    messageStudent: 'This phone has already been used to register another student. Ask your lecturer to reset your device if this is a mistake.',
    messageLecturer: 'A second account was attempted on a phone already linked to another matric. Likely proxy registration.',
    suggestedAction: 'see_lecturer',
  },

  DUPLICATE_CREDENTIAL: {
    code: 'DUPLICATE_CREDENTIAL',
    severity: 'error',
    category: 'proxy',
    messageStudent: 'This biometric credential is already linked to another account. Register on your own phone instead.',
    messageLecturer: 'The same WebAuthn credential was presented for a different matric. High-confidence proxy attempt.',
    suggestedAction: 'see_lecturer',
  },

  SYNCED_PASSKEY: {
    code: 'SYNCED_PASSKEY',
    severity: 'warning',
    category: 'proxy',
    messageStudent: 'Your passkey appears to be synced from another phone. For security, please register on the phone you will actually use.',
    messageLecturer: 'Registration appears to use a cloud-synced passkey rather than a device-bound one. May indicate account sharing.',
    suggestedAction: 'retry',
  },

  SAME_DEVICE_TODAY: {
    code: 'SAME_DEVICE_TODAY',
    severity: 'error',
    category: 'proxy',
    messageStudent: 'This phone was already used to check in for a different student today. You cannot check in for a friend.',
    messageLecturer: 'Same credentialId was used by two different matrics within one day. Blocked by proxy rule.',
    suggestedAction: 'none',
  },

  LOCATION_SPOOF_SUSPECTED: {
    code: 'LOCATION_SPOOF_SUSPECTED',
    severity: 'warning',
    category: 'spoof',
    messageStudent: 'We could not verify your location. Make sure you are physically inside the lecture hall and try again.',
    messageLecturer: 'Location fix failed the spoof-risk threshold. Possible fake GPS.',
    suggestedAction: 'retry',
  },

  MOTION_MISMATCH: {
    code: 'MOTION_MISMATCH',
    severity: 'warning',
    category: 'spoof',
    messageStudent: 'Your phone does not seem to be moving as expected. Please hold your own phone while checking in.',
    messageLecturer: 'DeviceMotion indicates the phone is stationary while GPS reports movement. Possible fake GPS.',
    suggestedAction: 'retry',
  },

  REMOTE_CHECKIN: {
    code: 'REMOTE_CHECKIN',
    severity: 'warning',
    category: 'spoof',
    messageStudent: 'You appear to be outside the campus network. Connect to campus WiFi or come to the lecture hall.',
    messageLecturer: 'Student IP differs from anchor IP and distance exceeds geofence. Possible remote check-in.',
    suggestedAction: 'retry',
  },

  GPS_WEAK: {
    code: 'GPS_WEAK',
    severity: 'info',
    category: 'technical',
    messageStudent: 'GPS signal is too weak to verify your location. Move near a window or step outside, then try again.',
    messageLecturer: 'Check-in attempt with accuracy > 100 m. Not counted as proxy; student asked to retry.',
    suggestedAction: 'retry',
  },

  OUT_OF_BOUNDS: {
    code: 'OUT_OF_BOUNDS',
    severity: 'warning',
    category: 'spoof',
    messageStudent: 'You are outside the allowed radius for this lecture hall. Move closer and try again.',
    messageLecturer: 'Student GPS coordinates placed them outside the geofence.',
    suggestedAction: 'retry',
  },

  NO_BIOMETRIC: {
    code: 'NO_BIOMETRIC',
    severity: 'error',
    category: 'technical',
    messageStudent: 'You must use biometric verification (fingerprint or FaceID) to check in. Please try again.',
    messageLecturer: 'Student attempted check-in without biometric verification.',
    suggestedAction: 'retry',
  },

  AMBIGUOUS_COLLISION: {
    code: 'AMBIGUOUS_COLLISION',
    severity: 'warning',
    category: 'proxy',
    messageStudent: 'We detected a possible device conflict. Your lecturer will review this. You can still check in.',
    messageLecturer: 'Hardware fingerprint matched an existing registration, but IP and timing suggest different people. Review to confirm.',
    suggestedAction: 'wait',
  },

  OFFLINE_QUEUED: {
    code: 'OFFLINE_QUEUED',
    severity: 'info',
    category: 'technical',
    messageStudent: 'Your check-in is saved offline and will sync automatically when your internet returns.',
    messageLecturer: 'Student checked in while offline. GPS and biometrics were captured at time of check-in.',
    suggestedAction: 'wait',
  },

  ALREADY_VERIFIED: {
    code: 'ALREADY_VERIFIED',
    severity: 'info',
    category: 'technical',
    messageStudent: 'You have already checked in to this session.',
    messageLecturer: 'Student attempted to check in again.',
    suggestedAction: 'none',
  },

  BATTERY_DEAD: {
    code: 'BATTERY_DEAD',
    severity: 'warning',
    category: 'manual',
    messageStudent: 'Your class rep logged your phone as dead. Wait for your lecturer to approve.',
    messageLecturer: 'Class rep logged a dead-battery request. Approve to mark as present.',
    suggestedAction: 'ask_rep',
  },

  HAND_RAISE: {
    code: 'HAND_RAISE',
    severity: 'warning',
    category: 'manual',
    messageStudent: 'You have requested manual verification. Show this screen to your lecturer.',
    messageLecturer: 'Student raised hand for manual verification.',
    suggestedAction: 'see_lecturer',
  },

  MANUAL_OVERRIDE: {
    code: 'MANUAL_OVERRIDE',
    severity: 'info',
    category: 'manual',
    messageStudent: 'Your lecturer marked you as present.',
    messageLecturer: 'Check-in approved manually.',
    suggestedAction: 'none',
  },
};