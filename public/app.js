// State
    let selectedFile = null;
    let currentAuditData = null;
    let currentFilter = 'all';
    let currentSearch = '';

    // Sample Delta Dental Data for Demo Testing
    const SAMPLE_BREAKDOWN_DATA = {
      is_sample: true,
      insurance_details: {
        patient_name: "Katherine Birdwell",
        dob: "04/12/1988",
        group_name: "Acme Industrial Group",
        group_number: "DD-948201",
        carrier: "Delta Dental PPO",
        effective_date: "01/01/2026",
        termed_date: "Active (None)",
        policy_status: "Active",
        network_status: "In Network",
        plan_benefits: "Calendar Year",
        fee_schedule: "Delta Dental PPO",
        payment_recipient: "Patient or Office",
        annual_maximum: 2000,
        remaining_maximum: 2000,
        preventive_applies_to_max: false,
        deductible_individual: 50,
        deductible_remaining: 50,
        deductible_applies_to: "Basic & Major Services Only (Waived on Preventive)",
        missing_tooth_clause: true,
        waiting_period: false
      },
      coverage_levels: {
        preventive: "100%",
        basic: "80%",
        major: "60%",
        endo: "80%",
        oral_surgery: "80%",
        implants: "NC",
        night_guard: "NC",
        waiting_period_details: "Basic 6mo Major 12",
        ortho: "50%",
        ortho_max: "$1,000",
        ortho_remaining: "$999",
        ortho_age_limit: "26",
        ortho_payment_terms: "Monthly"
      },
      audit_meta: {
        verified_by_name: "Clinic Admin",
        verified_at: "10/12/2026, 09:30 AM",
        readiness_status: "Complete / Ready for Appointment"
      },
      procedure_codes: [
        // 1. D4346
        { code: "D4346", description: "Scaling in presence of generalized moderate or severe gingival inflammation", coverage_percentage: "100%", deductible_applied: false, frequency_limitation: "2x1yr", age_limit: "None", is_eligible: true, history_dates: "History", downgrade_rule: "None", notes: "Shared freq with D1110" },
        // 2. D1110
        { code: "D1110", description: "Prophy (Adult Cleaning)", coverage_percentage: "100%", deductible_applied: false, frequency_limitation: "2x1yr", age_limit: "None", is_eligible: true, history_dates: "History", downgrade_rule: "None", notes: "Adult Prophylaxis" },
        // 3. D0274
        { code: "D0274", description: "BTW (Bitewings - Four Radiographic Images)", coverage_percentage: "100%", deductible_applied: false, frequency_limitation: "2x1yr", age_limit: "None", is_eligible: true, history_dates: "History", downgrade_rule: "None", notes: "Bitewings 4 films" },
        // 4. D0210 / D0330
        { code: "D0210 / D0330", description: "FMX (Complete Series) / Pano (Panoramic Image)", coverage_percentage: "100%", deductible_applied: false, frequency_limitation: "1x5yr (Shared D0210/D0330)", age_limit: "None", is_eligible: false, history_dates: "01/22/2025", downgrade_rule: "None", notes: "Shared freq D0210 & D0330 • Ineligible until 01/22/2030 (Last: 01/22/2025, Freq: 1x5yr)" },
        // 5. D0220
        { code: "D0220", description: "PA's (Intraoral - Periapical First Radiographic Image)", coverage_percentage: "100%", deductible_applied: false, frequency_limitation: "NF", age_limit: "None", is_eligible: true, history_dates: "History", downgrade_rule: "None", notes: "No frequency limitation (NF)" },
        // 6. D9110
        { code: "D9110", description: "Palliative (Emergency Treatment of Dental Pain)", coverage_percentage: "100%", deductible_applied: false, frequency_limitation: "2x1yr", age_limit: "None", is_eligible: true, history_dates: "History", downgrade_rule: "None", notes: "Emergency palliative" },
        // 7. D0120
        { code: "D0120", description: "Exam (Periodic Oral Evaluation)", coverage_percentage: "100%", deductible_applied: false, frequency_limitation: "2x1yr", age_limit: "None", is_eligible: true, history_dates: "10/25/2025", downgrade_rule: "None", notes: "Eligible (Benefit reset for Calendar Year 2026; Last service: 10/25/2025)" },
        // 8. D0140
        { code: "D0140", description: "Limited Exam (Problem Focused)", coverage_percentage: "100%", deductible_applied: false, frequency_limitation: "2x1yr", age_limit: "None", is_eligible: true, history_dates: "History", downgrade_rule: "None", notes: "Combined/Additional: Additional" },
        // 9. D1351
        { code: "D1351", description: "Sealant (Per Tooth)", coverage_percentage: "80%", deductible_applied: false, frequency_limitation: "1X24m", age_limit: "15", is_eligible: false, history_dates: "History", downgrade_rule: "None", notes: "Ineligible: Patient age (37) exceeds plan age limit (15)" },
        // 10. D1206
        { code: "D1206", description: "Flouride (Fluoride Varnish / Application)", coverage_percentage: "90%", deductible_applied: false, frequency_limitation: "2x1yr", age_limit: "18", is_eligible: false, history_dates: "History", downgrade_rule: "None", notes: "Ineligible: Patient age (37) exceeds plan age limit (18)" },
        // 11. D4341
        { code: "D4341", description: "SRP (Periodontal Scaling and Root Planing - 4+ teeth/quad)", coverage_percentage: "80%", deductible_applied: true, frequency_limitation: "1x1yr", age_limit: "None", is_eligible: true, history_dates: "None", downgrade_rule: "None", notes: "Quads Per Visit: All • Perio History: None" },
        // 12. D4910
        { code: "D4910", description: "Perio Maint (Periodontal Maintenance)", coverage_percentage: "80%", deductible_applied: true, frequency_limitation: "NF", age_limit: "None", is_eligible: true, history_dates: "None", downgrade_rule: "None", notes: "Freq w/ Prophy: Addition • PMV Perio History: None" },
        // 13. D2391
        { code: "D2391", description: "Filling (Resin-based Composite - 1 Surface, Posterior)", coverage_percentage: "80%", deductible_applied: true, frequency_limitation: "1x1yr", age_limit: "None", is_eligible: true, history_dates: "None", downgrade_rule: "No", notes: "Basic TX • Downgrade: No" },
        // 14. D2740
        { code: "D2740", description: "Crown (Porcelain/Ceramic Substrate)", coverage_percentage: "60%", deductible_applied: true, frequency_limitation: "60 months", age_limit: "None", is_eligible: true, history_dates: "None", downgrade_rule: "No", notes: "Major TX • Downgrade: No • Prep or Seat: Seat • Freq: 60 months" },
        // 15. D2920
        { code: "D2920", description: "Crown Recement", coverage_percentage: "60%", deductible_applied: true, frequency_limitation: "NF", age_limit: "None", is_eligible: true, history_dates: "None", downgrade_rule: "None", notes: "Major TX • Frequency: NF" },
        // 16. D7140
        { code: "D7140", description: "Simple ext (Simple Extraction)", coverage_percentage: "80%", deductible_applied: true, frequency_limitation: "1 per tooth lifetime", age_limit: "None", is_eligible: true, history_dates: "None", downgrade_rule: "None", notes: "Oral Surgery" },
        // 17. D7210
        { code: "D7210", description: "Surgical ext (Surgical Extraction)", coverage_percentage: "80%", deductible_applied: true, frequency_limitation: "1 per tooth lifetime", age_limit: "None", is_eligible: true, history_dates: "None", downgrade_rule: "None", notes: "Oral Surgery" },
        // 18. D9222 / D9223
        { code: "D9222 / D9223", description: "Sedation / General Anesthesia", coverage_percentage: "80%", deductible_applied: true, frequency_limitation: "With surgery", age_limit: "None", is_eligible: true, history_dates: "None", downgrade_rule: "None", notes: "Billed to Med First?: No" },
        // 19. D9944
        { code: "D9944", description: "Night Guard (Occlusal Guard)", coverage_percentage: "NC", deductible_applied: false, frequency_limitation: "Not Covered", age_limit: "None", is_eligible: false, history_dates: "None", downgrade_rule: "None", notes: "Not Covered (NC)" }
      ]
    };

    // HTML escape utility
    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // ==========================================
    // DATE & ELIGIBILITY UTILITY FUNCTIONS
    // ==========================================

    function parseDate(str) {
      if (!str) return null;
      const s = String(str).trim();
      if (/^(none|no|n\/a|na|history|null|undefined|-)$/i.test(s)) return null;

      // MM/DD/YYYY or M/D/YYYY
      const mdy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
      if (mdy) {
        let m = parseInt(mdy[1], 10) - 1;
        let d = parseInt(mdy[2], 10);
        let y = parseInt(mdy[3], 10);
        if (y < 100) y += 2000;
        const dt = new Date(y, m, d);
        return isNaN(dt.getTime()) ? null : dt;
      }

      // YYYY-MM-DD
      const ymd = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
      if (ymd) {
        let y = parseInt(ymd[1], 10);
        const m = parseInt(ymd[2], 10) - 1;
        const d = parseInt(ymd[3], 10);
        const dt = new Date(y, m, d);
        return isNaN(dt.getTime()) ? null : dt;
      }

      // MM/YYYY or M/YYYY
      const my = s.match(/^(\d{1,2})[\/\-\.](\d{2,4})$/);
      if (my) {
        let m = parseInt(my[1], 10) - 1;
        let y = parseInt(my[2], 10);
        if (y < 100) y += 2000;
        const dt = new Date(y, m, 1);
        return isNaN(dt.getTime()) ? null : dt;
      }

      const parsed = Date.parse(s);
      if (!isNaN(parsed)) {
        return new Date(parsed);
      }
      return null;
    }

    function parseFrequencyMonths(freqStr) {
      if (!freqStr) return 60;
      const str = String(freqStr).toLowerCase();

      // Months: "60 months", "1 in 36m", "36mo", "24m"
      const mMatch = str.match(/(\d+)\s*(?:m|mo|mos|month|months)\b/);
      if (mMatch) {
        const m = parseInt(mMatch[1], 10);
        if (m > 0) return m;
      }

      // Years: "1x5yr", "1 in 5 years", "3 years", "1/5yr", "5y"
      const yMatch = str.match(/(\d+)\s*(?:y|yr|yrs|year|years)\b/);
      if (yMatch) {
        const y = parseInt(yMatch[1], 10);
        if (y > 0) return y * 12;
      }

      // Generic "1 in 60" or "1/36"
      const numMatch = str.match(/1\s*(?:in|\/|x)\s*(\d+)/);
      if (numMatch) {
        const n = parseInt(numMatch[1], 10);
        if (n >= 12) return n;
        if (n > 0 && n <= 10) return n * 12;
      }

      return 60;
    }

    // Helper: standardizes long frequency sentences into concise clinical dental notation
    function formatFrequencyNotation(freqStr) {
      if (!freqStr) return '-';
      const raw = String(freqStr).trim();
      const s = raw.toLowerCase();

      // If already standard compact notation (e.g. 2x1yr, 2x12m, 1x5yr, 1x24m, NF, 1/LT)
      if (/^\d+x\d+(?:yr|y|m|mo)$/i.test(raw) || /^(nf|none|n\/a|1\/lt|1\/tooth lt)$/i.test(raw)) {
        return raw;
      }

      // Check for "no frequency" / "unlimited"
      if (/no\s*frequency|unlimited|none|no\s*limit/i.test(s)) {
        return 'NF';
      }

      // Lifetime
      if (/lifetime/i.test(s)) {
        if (/tooth/i.test(s)) return '1/tooth LT';
        return '1/LT';
      }

      // Count determination
      let count = 1;
      if (/two|twice|\b2\b/i.test(s)) {
        count = 2;
      } else if (/four|\b4\b/i.test(s)) {
        count = 4;
      } else if (/three|\b3\b/i.test(s)) {
        count = 3;
      } else if (/one|once|\b1\b/i.test(s)) {
        count = 1;
      }

      // Period determination: Calendar year vs rolling months vs years
      if (/calendar\s*year/i.test(s)) {
        return `${count}x1yr`;
      }

      // Months pattern (e.g. "within 12 months", "in 12 months", "12m", "24m", "60 months", "36 months")
      const mMatch = s.match(/(\d+)\s*(?:m|mo|mos|month|months)\b/);
      if (mMatch) {
        const months = parseInt(mMatch[1], 10);
        if (months === 12) {
          return `${count}x12m`;
        }
        if (months === 24) {
          return `${count}x24m`;
        }
        if (months === 36) {
          return `${count}x36m`;
        }
        if (months === 60) {
          return `${count}x5yr`;
        }
        return `${count}x${months}m`;
      }

      // Years pattern (e.g. "within 1 year", "per year", "every 5 years", "in 3 years")
      const yMatch = s.match(/(\d+)\s*(?:y|yr|yrs|year|years)\b/);
      if (yMatch) {
        const years = parseInt(yMatch[1], 10);
        return `${count}x${years}yr`;
      }

      if (/per\s*year|a\s*year|every\s*year|annual/i.test(s)) {
        return `${count}x1yr`;
      }

      if (raw.length <= 12) {
        return raw;
      }

      if (/calendar/i.test(s)) return `${count}x1yr`;
      if (/12\s*m/i.test(s)) return `${count}x12m`;

      return raw;
    }

    function formatDate(d) {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${mm}/${dd}/${yyyy}`;
    }

    function calculateAge(dobStr, asOfDate = new Date()) {
      const birthDate = parseDate(dobStr);
      if (!birthDate) return null;
      let age = asOfDate.getFullYear() - birthDate.getFullYear();
      const m = asOfDate.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && asOfDate.getDate() < birthDate.getDate())) {
        age--;
      }
      return age >= 0 ? age : null;
    }

    // ==========================================
    // 1. POLICY TERMED DATE & STATUS VALIDATOR
    // ==========================================
    function enforcePolicyTermedRules(insuranceDetails) {
      if (!insuranceDetails) return insuranceDetails;
      const termedStr = String(insuranceDetails.termed_date || '').trim();
      const today = new Date();

      if (!termedStr || /^(none|active|n\/a|na|-)$/i.test(termedStr)) {
        insuranceDetails.policy_status = 'Active';
        insuranceDetails.termed_date = insuranceDetails.termed_date || 'Active (None)';
        return insuranceDetails;
      }

      const termedDt = parseDate(termedStr);
      if (termedDt) {
        const endOfTermedDay = new Date(termedDt.getFullYear(), termedDt.getMonth(), termedDt.getDate(), 23, 59, 59);
        if (today > endOfTermedDay) {
          insuranceDetails.policy_status = 'Termed / Inactive';
        } else {
          insuranceDetails.policy_status = 'Active';
        }
      } else if (/term/i.test(termedStr) || /inact/i.test(termedStr)) {
        insuranceDetails.policy_status = 'Termed / Inactive';
      } else {
        insuranceDetails.policy_status = 'Active';
      }
      return insuranceDetails;
    }

    // ==========================================
    // 2. AGE LIMIT & CALENDAR YEAR FREQUENCY VALIDATOR
    // ==========================================
    function enforceAgeLimitAndFrequencyRules(procedureCodes, insuranceDetails = {}) {
      if (!Array.isArray(procedureCodes) || procedureCodes.length === 0) {
        return procedureCodes;
      }

      const patientDob = insuranceDetails.dob || '';
      const patientAge = calculateAge(patientDob);
      const planBenefits = String(insuranceDetails.plan_benefits || '').toLowerCase();
      const isCalendarYearPlan = planBenefits.includes('calendar') || !planBenefits.includes('contract');
      const today = new Date();
      const currentYear = today.getFullYear();

      procedureCodes.forEach(item => {
        if (!item) return;
        const code = String(item.code || '').toUpperCase();
        const ageLimStr = String(item.age_limit || '').trim();
        const freqStr = String(item.frequency_limitation || '').trim().toLowerCase();
        const histStr = String(item.history_dates || '').trim();

        // 1. AGE LIMITATION CHECK (Minimum vs Maximum Age Thresholds)
        if (patientAge !== null && ageLimStr && !/^(none|nl|no limit|n\/a|-)$/i.test(ageLimStr)) {
          const match = ageLimStr.match(/(\d+)/);
          if (match) {
            const targetAge = parseInt(match[1], 10);

            const hasMinKeywords = /(and\s*over|and\s*older|&\s*over|&\s*older|\+|and\s*up|or\s*older|or\s*over|min\b|minimum|>=|>|over)/i.test(ageLimStr);
            const isAdultCode = code.includes('D1110') || code.includes('D4346');
            const hasMaxKeywords = /(under|through|up\s*to|to\s*age|and\s*under|&\s*under|or\s*younger|max\b|maximum|<=|<)/i.test(ageLimStr);

            const isMinAge = hasMinKeywords || (isAdultCode && !hasMaxKeywords);

            if (isMinAge) {
              // Minimum Age Requirement (e.g. D1110, D4346: 14 and over)
              if (patientAge < targetAge) {
                item.is_eligible = false;
                const ageNote = `Ineligible: Patient age (${patientAge}) is below plan minimum age requirement (${targetAge})`;
                if (!item.notes || !item.notes.includes('below plan minimum age')) {
                  item.notes = item.notes ? `${item.notes} • ${ageNote}` : ageNote;
                }
              } else {
                // Patient meets or exceeds minimum age (e.g. 27 >= 14 -> ELIGIBLE!)
                if (item.notes && item.notes.includes('exceeds plan age limit')) {
                  item.notes = item.notes
                    .replace(/\s*•\s*Ineligible:\s*Patient age \(\d+\) exceeds plan age limit \(\d+\)/gi, '')
                    .replace(/Ineligible:\s*Patient age \(\d+\) exceeds plan age limit \(\d+\)\s*•\s*/gi, '')
                    .replace(/Ineligible:\s*Patient age \(\d+\) exceeds plan age limit \(\d+\)/gi, '')
                    .trim();
                }
                if (!histStr || /^(none|n\/a|-)$/i.test(histStr)) {
                  item.is_eligible = true;
                }
              }
            } else {
              // Maximum Age Limitation (e.g. D1206 Fluoride, D1351 Sealants, Ortho, D1120 Child Prophy)
              const isStrictlyUnder = /under\s*\d+|<\s*\d+/i.test(ageLimStr);
              const exceedsMax = isStrictlyUnder ? (patientAge >= targetAge) : (patientAge > targetAge);

              if (exceedsMax) {
                item.is_eligible = false;
                const ageNote = `Ineligible: Patient age (${patientAge}) exceeds plan age limit (${targetAge})`;
                if (!item.notes || !item.notes.includes('exceeds plan age limit')) {
                  item.notes = item.notes ? `${item.notes} • ${ageNote}` : ageNote;
                }
              }
            }
          }
        }

        // Skip D0210/D0330 as it has its own shared handler
        if (code.includes('D0210') || code.includes('D0330')) {
          return;
        }

        // 2. CALENDAR YEAR VS ROLLING MONTHS FREQUENCY LOGIC
        const histDate = parseDate(histStr);
        if (histDate) {
          const isYearlyFreq = /2x1yr|1x1yr|2xyr|1xyr|2\s*in\s*1\s*year|1\s*in\s*1\s*year|calendar/i.test(freqStr);
          const isRollingFreq = /2x12m|1x12m|12\s*m|12\s*mo|rolling/i.test(freqStr);

          if (isCalendarYearPlan && isYearlyFreq) {
            // Calendar Year basis: resets on January 1st!
            if (histDate.getFullYear() < currentYear) {
              item.is_eligible = true;
              const resetNote = `Eligible (Benefit reset for Calendar Year ${currentYear}; Last service: ${formatDate(histDate)})`;
              if (!item.notes || !item.notes.includes('Calendar Year')) {
                item.notes = item.notes ? `${item.notes} • ${resetNote}` : resetNote;
              }
            }
          } else if (isRollingFreq) {
            const twelveMonthsAgo = new Date(today);
            twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

            if (histDate >= twelveMonthsAgo) {
              if (/2x12m|2\s*in\s*12/i.test(freqStr)) {
                item.is_eligible = true;
                const rollNote = `Eligible: 1 of 2 procedures remaining in rolling 12m (Last service: ${formatDate(histDate)})`;
                if (!item.notes || !item.notes.includes('rolling 12m')) {
                  item.notes = item.notes ? `${item.notes} • ${rollNote}` : rollNote;
                }
              }
            }
          }
        }

        // 3. Compact Frequency String Normalization
        if (item.frequency_limitation) {
          item.frequency_limitation = formatFrequencyNotation(item.frequency_limitation);
        }
      });

      return procedureCodes;
    }

    // ==========================================
    // 3. D0210 & D0330 SHARED FREQUENCY & ELIGIBILITY VALIDATOR
    // ==========================================
    function enforceSharedFmxPanoRules(procedureCodes) {
      if (!Array.isArray(procedureCodes) || procedureCodes.length === 0) {
        return procedureCodes;
      }

      const fmxPanoItems = procedureCodes.filter(item => {
        if (!item) return false;
        const code = String(item.code || '').toUpperCase();
        const desc = String(item.description || '').toLowerCase();
        return (
          code.includes('D0210') ||
          code.includes('D0330') ||
          desc.includes('fmx') ||
          desc.includes('pano') ||
          desc.includes('panoramic') ||
          desc.includes('complete series') ||
          desc.includes('intraoral - comprehensive series')
        );
      });

      if (fmxPanoItems.length === 0) {
        return procedureCodes;
      }

      let sharedFreqText = '';
      let foundFreqMonths = null;

      for (const item of fmxPanoItems) {
        const freq = String(item.frequency_limitation || '').trim();
        if (freq && !/^(nf|none|no|n\/a|-)$/i.test(freq)) {
          sharedFreqText = freq;
          foundFreqMonths = parseFrequencyMonths(freq);
          break;
        }
      }

      if (!sharedFreqText) {
        sharedFreqText = '1x5yr';
        foundFreqMonths = 60;
      }
      const frequencyMonths = foundFreqMonths || 60;

      let latestHistoryDate = null;
      let rawHistoryStr = 'None';

      for (const item of fmxPanoItems) {
        const histStr = String(item.history_dates || '').trim();
        const parsed = parseDate(histStr);
        if (parsed) {
          if (!latestHistoryDate || parsed > latestHistoryDate) {
            latestHistoryDate = parsed;
            rawHistoryStr = histStr;
          }
        }
      }

      const today = new Date();
      let isEligible = true;
      let nextEligibleDate = null;
      let formattedNextDate = '';
      let formattedHistDate = '';

      if (latestHistoryDate) {
        formattedHistDate = formatDate(latestHistoryDate);
        nextEligibleDate = new Date(latestHistoryDate.getTime());
        nextEligibleDate.setMonth(nextEligibleDate.getMonth() + frequencyMonths);
        formattedNextDate = formatDate(nextEligibleDate);

        if (today < nextEligibleDate) {
          isEligible = false;
        } else {
          isEligible = true;
        }
      }

      fmxPanoItems.forEach(item => {
        const codeUpper = String(item.code || '').toUpperCase();
        const isCombo = codeUpper.includes('D0210') && codeUpper.includes('D0330');
        const isFmxOnly = codeUpper.includes('D0210') && !codeUpper.includes('D0330');
        const isPanoOnly = codeUpper.includes('D0330') && !codeUpper.includes('D0210');

        let sharedFreqLabel = sharedFreqText;
        if (!sharedFreqLabel.toLowerCase().includes('shared')) {
          if (isCombo) {
            sharedFreqLabel = `${sharedFreqLabel} (Shared D0210/D0330)`;
          } else if (isFmxOnly) {
            sharedFreqLabel = `${sharedFreqLabel} (Shared w/ D0330)`;
          } else if (isPanoOnly) {
            sharedFreqLabel = `${sharedFreqLabel} (Shared w/ D0210)`;
          } else {
            sharedFreqLabel = `${sharedFreqLabel} (Shared)`;
          }
        }
        item.frequency_limitation = sharedFreqLabel;

        const covStr = String(item.coverage_percentage || '').trim().toUpperCase();
        const isCoveredBenefit = covStr !== '0%' && covStr !== 'NC' && !covStr.includes('NOT COVERED');

        if (!isCoveredBenefit) {
          item.is_eligible = false;
          item.notes = item.notes ? `${item.notes} • Not Covered` : 'Not Covered by Plan';
          return;
        }

        if (latestHistoryDate) {
          item.history_dates = formattedHistDate;
          item.is_eligible = isEligible;

          const partnerNote = isCombo
            ? 'Shared freq D0210 & D0330'
            : (isFmxOnly ? 'Shared freq with D0330 Pano' : 'Shared freq with D0210 FMX');

          if (!isEligible) {
            item.notes = `${partnerNote} • Ineligible until ${formattedNextDate} (Last: ${formattedHistDate}, Freq: ${sharedFreqText})`;
          } else {
            item.notes = `${partnerNote} • Eligible (Frequency satisfied: Last service ${formattedHistDate})`;
          }
        } else {
          item.history_dates = 'None';
          item.is_eligible = true;
          const partnerNote = isCombo
            ? 'Shared freq D0210 & D0330'
            : (isFmxOnly ? 'Shared freq with D0330' : 'Shared freq with D0210');

          if (!item.notes || !item.notes.toLowerCase().includes('shared')) {
            item.notes = item.notes ? `${partnerNote} • ${item.notes}` : partnerNote;
          }
        }
      });

      return procedureCodes;
    }

    // Built-in ADA CDT Code Dictionary (Locked in Website Memory — Non-Editable Meanings)
    const CDT_CODE_DICTIONARY = Object.freeze({
      'D4346': 'Scaling in presence of gingival inflammation',
      'D1110': 'Prophy (Adult Cleaning)',
      'D1120': 'Prophy (Child Cleaning)',
      'D0274': 'BTW (Bitewings - Four Radiographic Images)',
      'D0272': 'BTW (Bitewings - Two Radiographic Images)',
      'D0210 / D0330': 'FMX (Complete Series) / Pano (Panoramic Image)',
      'D0210': 'FMX (Intraoral - Complete Series of Radiographic Images)',
      'D0330': 'Pano (Panoramic Radiographic Image)',
      'D0220': "PA's (Intraoral - Periapical First Radiographic Image)",
      'D0230': "PA's (Intraoral - Periapical Each Additional Image)",
      'D9110': 'Palliative (Emergency Treatment of Dental Pain)',
      'D0120': 'Exam (Periodic Oral Evaluation)',
      'D0140': 'Limited Exam (Problem Focused Oral Evaluation)',
      'D0150': 'Comprehensive Oral Evaluation (New or Established Patient)',
      'D0180': 'Comprehensive Periodontal Evaluation',
      'D1351': 'Sealant (Per Tooth)',
      'D1354': 'Interim Caries Arresting Medicament Application (SDF)',
      'D1206': 'Fluoride (Topical Application of Fluoride Varnish)',
      'D1208': 'Topical Application of Fluoride (Excluding Varnish)',
      'D1510': 'Space Maintainer (Fixed, Unilateral)',
      'D4341': 'SRP (Periodontal Scaling & Root Planing - 4+ Teeth per Quad)',
      'D4342': 'SRP (Periodontal Scaling & Root Planing - 1 to 3 Teeth per Quad)',
      'D4910': 'Perio Maint (Periodontal Maintenance)',
      'D4355': 'Full Mouth Debridement',
      'D4381': 'Localized Delivery of Antimicrobial Agents (Arestin)',
      'D2391': 'Filling / Composite (Resin-Based Composite - 1 Surface, Posterior)',
      'D2392': 'Filling / Composite (Resin-Based Composite - 2 Surfaces, Posterior)',
      'D2393': 'Filling / Composite (Resin-Based Composite - 3 Surfaces, Posterior)',
      'D2394': 'Filling / Composite (Resin-Based Composite - 4+ Surfaces, Posterior)',
      'D2330': 'Filling / Composite (Resin-Based Composite - 1 Surface, Anterior)',
      'D2331': 'Filling / Composite (Resin-Based Composite - 2 Surfaces, Anterior)',
      'D2332': 'Filling / Composite (Resin-Based Composite - 3 Surfaces, Anterior)',
      'D2335': 'Filling / Composite (Resin-Based Composite - 4+ Surfaces / Incisal, Anterior)',
      'D2140': 'Amalgam - One Surface, Primary or Permanent',
      'D2150': 'Amalgam - Two Surfaces, Primary or Permanent',
      'D2160': 'Amalgam - Three Surfaces, Primary or Permanent',
      'D2740': 'Crown (Porcelain / Ceramic Substrate)',
      'D2750': 'Crown (Porcelain Fused to High Noble Metal)',
      'D2751': 'Crown (Porcelain Fused to Predominantly Base Metal)',
      'D2752': 'Crown (Porcelain Fused to Noble Metal)',
      'D2790': 'Crown (Full Cast High Noble Metal)',
      'D2920': 'Crown Recement (Re-cement or Re-bond Crown)',
      'D2950': 'Core Buildup, Including Any Pins When Required',
      'D2954': 'Prefabricated Post and Core in Addition to Crown',
      'D3310': 'Endodontic Therapy, Anterior Tooth (Excluding Final Restoration)',
      'D3320': 'Endodontic Therapy, Premolar Tooth (Excluding Final Restoration)',
      'D3330': 'Endodontic Therapy, Molar Tooth (Excluding Final Restoration)',
      'D3220': 'Therapeutic Pulpotomy',
      'D5110': 'Complete Denture - Maxillary',
      'D5120': 'Complete Denture - Mandibular',
      'D5213': 'Maxillary Partial Denture - Cast Metal Framework',
      'D5214': 'Mandibular Partial Denture - Cast Metal Framework',
      'D6010': 'Implants (Surgical Placement of Implant Body: Endosteal Implant)',
      'D6058': 'Abutment Supported Porcelain/Ceramic Crown',
      'D6065': 'Implant Supported Porcelain/Ceramic Crown',
      'D6240': 'Pontic - Porcelain Fused to High Noble Metal (Bridge)',
      'D6740': 'Retainer Crown - Porcelain/Ceramic (Bridge)',
      'D7140': 'Simple Ext (Extraction, Erupted Tooth or Exposed Root)',
      'D7210': 'Surgical Ext (Extraction, Erupted Tooth Requiring Bone Removal)',
      'D7220': 'Removal of Impacted Tooth - Soft Tissue',
      'D7230': 'Removal of Impacted Tooth - Partially Bony',
      'D7240': 'Removal of Impacted Tooth - Completely Bony',
      'D7953': 'Bone Replacement Graft for Ridge Preservation - Per Site',
      'D8080': 'Comprehensive Orthodontic Treatment of the Adolescent Dentition',
      'D8090': 'Comprehensive Orthodontic Treatment of the Adult Dentition',
      'D9222 / D9223': 'Sedation / Anesthesia (Deep Sedation / General Anesthesia)',
      'D9222': 'Deep Sedation / General Anesthesia - First 15 Minutes',
      'D9223': 'Deep Sedation / General Anesthesia - Each Subsequent 15 Minutes',
      'D9230': 'Inhalation of Nitrous Oxide / Analgesia, Anxiolysis',
      'D9248': 'Non-Intravenous Conscious Sedation',
      'D9310': 'Consultation - Diagnostic Service',
      'D9944': 'Night Guard (Occlusal Guard - Hard Appliance, Full Arch)',
      'D9945': 'Night Guard (Occlusal Guard - Soft Appliance, Full Arch)',
      'D9946': 'Night Guard (Occlusal Guard - Hard Appliance, Partial Arch)',
      'D9940': 'Occlusal Guard, by Report',
    });

    function getCanonicalCdtMeaning(rawCode, fallbackDesc = '') {
      if (!rawCode) return fallbackDesc || '-';
      const upper = String(rawCode).trim().toUpperCase();
      if (CDT_CODE_DICTIONARY[upper]) return CDT_CODE_DICTIONARY[upper];
      if (upper.includes('D0210') && upper.includes('D0330')) return CDT_CODE_DICTIONARY['D0210 / D0330'];
      if (upper.includes('D9222') && upper.includes('D9223')) return CDT_CODE_DICTIONARY['D9222 / D9223'];
      const singleMatch = upper.match(/D\d{4}/);
      if (singleMatch && CDT_CODE_DICTIONARY[singleMatch[0]]) {
        return CDT_CODE_DICTIONARY[singleMatch[0]];
      }
      return fallbackDesc || '-';
    }

    function enforceCanonicalCdtMeanings(procedureCodes) {
      if (!Array.isArray(procedureCodes)) return procedureCodes;
      procedureCodes.forEach(item => {
        if (!item) return;
        item.description = getCanonicalCdtMeaning(item.code, item.description);
      });
      return procedureCodes;
    }

    const DEFAULT_ENABLED_CDT_CODES = [
      'D4346', 'D1110', 'D0274', 'D0210 / D0330', 'D0220', 'D9110', 'D0120', 'D0140', 'D1351', 'D1206',
      'D4341', 'D4910', 'D2391', 'D2740', 'D2920', 'D7140', 'D7210', 'D9222 / D9223', 'D9944', 'D6010'
    ];
    let activeEnabledCdtCodes = DEFAULT_ENABLED_CDT_CODES.slice();

    // Exact Procedure Clinical Sequence Mapping (Prioritizes Active Clinic's Custom Sequence -> Fallback Default Order)
    function getProcedureOrderRank(code) {
      if (!code) return 999;
      const c = String(code).trim().toUpperCase();
      if (Array.isArray(activeEnabledCdtCodes) && activeEnabledCdtCodes.length > 0) {
        for (let i = 0; i < activeEnabledCdtCodes.length; i++) {
          const target = String(activeEnabledCdtCodes[i] || '').trim().toUpperCase();
          if (!target) continue;
          if (c === target) return i + 1;
          if (target.includes('D0210') && (c.includes('D0210') || c.includes('D0330'))) return i + 1;
          if (target.includes('D9222') && (c.includes('D9222') || c.includes('D9223'))) return i + 1;
          if (c.includes(target)) return i + 1;
        }
      }
      // Fallback 1-20 default sequence
      if (c.includes('D4346')) return 201;
      if (c.includes('D1110')) return 202;
      if (c.includes('D0274')) return 203;
      if (c.includes('D0210') || c.includes('D0330')) return 204;
      if (c.includes('D0220')) return 205;
      if (c.includes('D9110')) return 206;
      if (c.includes('D0120')) return 207;
      if (c.includes('D0140')) return 208;
      if (c.includes('D1351')) return 209;
      if (c.includes('D1206')) return 210;
      if (c.includes('D4341')) return 211;
      if (c.includes('D4910')) return 212;
      if (c.includes('D2391')) return 213;
      if (c.includes('D2740')) return 214;
      if (c.includes('D2920')) return 215;
      if (c.includes('D7140')) return 216;
      if (c.includes('D7210')) return 217;
      if (c.includes('D9222') || c.includes('D9223')) return 218;
      if (c.includes('D9944')) return 219;
      if (c.includes('D6010')) return 220;
      return 300;
    }

    // Strict categorization into the 5 clinical breakdown categories:
    // 1. Preventative, 2. Periodontal, 3. Restorative (D2391), 4. Major, 5. Ortho
    function categorizeProcedureCode(item) {
      if (!item) return 'major';
      const code = String(item.code || '').toUpperCase().trim();
      const desc = String(item.description || '').toLowerCase();

      // 1. Preventative
      if (
        code.includes('D4346') ||
        code.includes('D1110') ||
        code.includes('D0274') ||
        code.includes('D0210') ||
        code.includes('D0330') ||
        code.includes('D0220') ||
        code.includes('D9110') ||
        code.includes('D0120') ||
        code.includes('D0140') ||
        code.includes('D1351') ||
        code.includes('D1206') ||
        code.includes('D1120') ||
        code.includes('D0150') ||
        code.includes('D0180') ||
        code.includes('D0272') ||
        code.includes('D0230') ||
        code.includes('D1208') ||
        desc.includes('prophy') ||
        desc.includes('exam') ||
        desc.includes('bitewing') ||
        desc.includes('fluoride') ||
        desc.includes('flouride') ||
        desc.includes('sealant') ||
        desc.includes('palliative')
      ) {
        return 'preventative';
      }

      // 2. Periodontal
      if (
        code.includes('D4341') ||
        code.includes('D4910') ||
        code.includes('D4342') ||
        code.includes('D4381') ||
        desc.includes('srp') ||
        desc.includes('scaling and root') ||
        desc.includes('perio maint') ||
        desc.includes('periodontal')
      ) {
        return 'periodontal';
      }

      // 3. Restorative (user: 2391 - mao rani nga code ang sa restorative)
      if (
        code.includes('D2391') ||
        code.includes('2391') ||
        (code.startsWith('D2') && !code.includes('D2740') && !code.includes('D2920') && (desc.includes('filling') || desc.includes('composite') || desc.includes('amalgam') || desc.includes('resin')))
      ) {
        return 'restorative';
      }

      // 5. Ortho
      if (
        code.includes('ORTHO') ||
        code.includes('D8080') ||
        code.includes('D8090') ||
        code.includes('D8670') ||
        desc.includes('ortho')
      ) {
        return 'ortho';
      }

      // 4. Major (D2740, D2920, D7140, D7210, D9222/D9223, D9944, D6010, etc.)
      return 'major';
    }

    // ── Pre-configured Payer Addresses & Master Claims Hubs Directory (Clinic-Isolated) ──────────
    const PAYER_DIRECTORY_STORAGE_KEY = 'dentverify_payer_directory';
    const DEFAULT_PAYER_DIRECTORY = [
      {
        id: 'dd_ca',
        parentCarrier: 'Delta Dental Ins',
        name: 'DD Ins (Delta Dental Multi-State Hub)',
        carrier: 'DD Ins (Delta Dental Multi-State Hub)',
        network: 'In-Network',
        networkStatus: 'In-Network',
        feeSchedule: 'Delta Dental PPO',
        matchKeys: [
          'dd ins', 'dd ca', 'dd tx', 'dd pa', 'dd ny', 'dd fl', 'dd ga', 'dd il', 'dd mi',
          'dd wa', 'dd nj', 'dd oh', 'dd va', 'dd ma', 'dd nc', 'dd az', 'dd co', 'dd mn',
          'dd mo', 'dd wi', 'dd md', 'dd in', 'dd tn', 'dd or',
          'delta dental of california', 'delta dental ca', 'delta ca', 'delta dental ins', 'delta dental'
        ],
        address: 'P.O. Box 997330, Sacramento, CA 95899-7330',
        phone: '(888) 335-8227',
        payorId: '94276'
      },
      {
        id: 'dd_fep',
        parentCarrier: 'Delta Dental Ins',
        name: 'Delta Dental FEP (DD FEP)',
        carrier: 'Delta Dental FEP (DD FEP)',
        network: 'Out-of-Network',
        networkStatus: 'Out-of-Network',
        feeSchedule: 'Delta Dental FEP / UCR',
        matchKeys: ['dd fep', 'delta dental fep', 'federal employees dental', 'fedvip delta'],
        address: 'P.O. Box 537007, Sacramento, CA 95853-7007',
        phone: '(855) 410-3255',
        payorId: 'FEPDD'
      },
      {
        id: 'dd_ppo',
        parentCarrier: 'Delta Dental Ins',
        name: 'Delta Dental PPO / National',
        carrier: 'Delta Dental PPO / National',
        network: 'In-Network',
        networkStatus: 'In-Network',
        feeSchedule: 'Delta Dental PPO',
        matchKeys: ['delta ppo', 'delta premier', 'delta dental ppo'],
        address: 'P.O. Box 9051, Farmington Hills, MI 48333',
        phone: '(800) 524-0149',
        payorId: '05430'
      },
      {
        id: 'payer_metlife',
        parentCarrier: 'MetLife',
        name: 'MetLife Dental PDP',
        carrier: 'MetLife Dental PDP',
        network: 'In-Network',
        networkStatus: 'In-Network',
        feeSchedule: 'MetLife PDP Plus',
        matchKeys: ['metlife', 'met life'],
        address: 'P.O. Box 981282, El Paso, TX 79998',
        phone: '(877) 638-3379',
        payorId: '65978'
      },
      {
        id: 'payer_cigna',
        parentCarrier: 'Cigna',
        name: 'Cigna Dental DPPO',
        carrier: 'Cigna Dental DPPO',
        network: 'In-Network',
        networkStatus: 'In-Network',
        feeSchedule: 'Cigna Total DPPO',
        matchKeys: ['cigna'],
        address: 'P.O. Box 188037, Chattanooga, TN 37422',
        phone: '(800) 244-6224',
        payorId: '62308'
      },
      {
        id: 'payer_guardian',
        parentCarrier: 'Guardian',
        name: 'Guardian DentalGuard Preferred',
        carrier: 'Guardian DentalGuard Preferred',
        network: 'In-Network',
        networkStatus: 'In-Network',
        feeSchedule: 'Guardian DentalGuard Preferred',
        matchKeys: ['guardian'],
        address: 'P.O. Box 981572, El Paso, TX 79998',
        phone: '(800) 541-7846',
        payorId: '13463'
      },
      {
        id: 'payer_aetna',
        parentCarrier: 'Aetna',
        name: 'Aetna Dental PPO',
        carrier: 'Aetna Dental PPO',
        network: 'In-Network',
        networkStatus: 'In-Network',
        feeSchedule: 'Aetna Dental PPO II',
        matchKeys: ['aetna'],
        address: 'P.O. Box 14094, Lexington, KY 40512',
        phone: '(877) 238-6200',
        payorId: '60054'
      },
      {
        id: 'payer_ameritas',
        parentCarrier: 'Other',
        name: 'Ameritas Life Insurance',
        carrier: 'Ameritas Life Insurance',
        network: 'In-Network',
        networkStatus: 'In-Network',
        feeSchedule: 'Ameritas Classic PPO',
        matchKeys: ['ameritas'],
        address: 'P.O. Box 81889, Lincoln, NE 68501',
        phone: '(800) 487-5553',
        payorId: '47009'
      },
      {
        id: 'payer_uhc',
        parentCarrier: 'Other',
        name: 'UnitedHealthcare Dental',
        carrier: 'UnitedHealthcare Dental',
        network: 'In-Network',
        networkStatus: 'In-Network',
        feeSchedule: 'UHC National Options PPO',
        matchKeys: ['unitedhealthcare', 'united healthcare', 'uhc'],
        address: 'P.O. Box 30567, Salt Lake City, UT 84130',
        phone: '(877) 816-3596',
        payorId: '52133'
      },
      {
        id: 'payer_bcbs',
        parentCarrier: 'Other',
        name: 'Blue Cross Blue Shield (BCBS)',
        carrier: 'Blue Cross Blue Shield (BCBS)',
        network: 'In-Network',
        networkStatus: 'In-Network',
        feeSchedule: 'BCBS Dental Grid PPO',
        matchKeys: ['blue cross', 'bluecross', 'bcbs', 'anthem', 'regence', 'premera', 'horizon', 'carefirst'],
        address: 'P.O. Box 660247, Dallas, TX 75266',
        phone: '(800) 521-2227',
        payorId: '84980'
      },
      {
        id: 'payer_humana',
        parentCarrier: 'Other',
        name: 'Humana Dental',
        carrier: 'Humana Dental',
        network: 'Out-of-Network',
        networkStatus: 'Out-of-Network',
        feeSchedule: 'Humana PPO / Out-of-Network',
        matchKeys: ['humana'],
        address: 'P.O. Box 14611, Lexington, KY 40512',
        phone: '(800) 233-4013',
        payorId: '61101'
      },
      {
        id: 'payer_principal',
        parentCarrier: 'Other',
        name: 'Principal Financial Group',
        carrier: 'Principal Financial Group',
        network: 'In-Network',
        networkStatus: 'In-Network',
        feeSchedule: 'Principal Plan Dental PPO',
        matchKeys: ['principal'],
        address: 'P.O. Box 10350, Des Moines, IA 50306',
        phone: '(800) 247-4695',
        payorId: '61271'
      }
    ];

    let activeClinicPayers = null;

    function normalizePayerItem(p, idx = 0) {
      const displayName = p.name || p.carrier || 'Dental Carrier';
      const parentGroup = p.parentCarrier || p.parentGroup || (displayName.toLowerCase().includes('delta') ? 'Delta Dental Ins' : 'Standard Carrier');
      const net = p.network || p.networkStatus || 'In-Network';
      const defaultFee = displayName.toLowerCase().includes('delta') ? 'Delta Dental PPO' : (displayName + ' PPO');
      let parsedMatchKeys = [displayName.toLowerCase()];
      if (Array.isArray(p.matchKeys) && p.matchKeys.length > 0) {
        parsedMatchKeys = p.matchKeys.map(k => String(k || '').trim().toLowerCase()).filter(Boolean);
      } else if (typeof p.matchKeys === 'string' && p.matchKeys.trim()) {
        parsedMatchKeys = p.matchKeys.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      }
      return {
        id: p.id || ('payer_' + idx + '_' + Date.now()),
        parentCarrier: parentGroup,
        name: displayName,
        carrier: displayName,
        network: net,
        networkStatus: net,
        feeSchedule: p.feeSchedule || defaultFee,
        matchKeys: parsedMatchKeys,
        address: p.address || 'N/A',
        phone: p.phone || 'N/A',
        payorId: p.payorId || 'N/A',
        isCustom: Boolean(p.isCustom)
      };
    }

    async function loadClinicPayersFromServer() {
      try {
        const res = await fetch('/api/payers');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.payers) && data.payers.length > 0) {
            activeClinicPayers = data.payers.map((item, idx) => normalizePayerItem(item, idx));
            return activeClinicPayers;
          }
        }
      } catch (e) {
        console.warn('Could not load clinic payers from server:', e);
      }
      activeClinicPayers = DEFAULT_PAYER_DIRECTORY.map((item, idx) => normalizePayerItem(item, idx));
      return activeClinicPayers;
    }

    function getPayerDirectory() {
      if (activeClinicPayers && activeClinicPayers.length > 0) {
        return activeClinicPayers;
      }
      try {
        const raw = localStorage.getItem(PAYER_DIRECTORY_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            activeClinicPayers = parsed.map((item, idx) => normalizePayerItem(item, idx));
            return activeClinicPayers;
          }
        }
      } catch (e) {}
      activeClinicPayers = DEFAULT_PAYER_DIRECTORY.map((item, idx) => normalizePayerItem(item, idx));
      return activeClinicPayers;
    }

    async function savePayerDirectory(list) {
      const normalized = list.map((item, idx) => normalizePayerItem(item, idx));
      activeClinicPayers = normalized;
      try {
        localStorage.setItem(PAYER_DIRECTORY_STORAGE_KEY, JSON.stringify(normalized));
      } catch (e) {}
      try {
        await fetch('/api/payers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payers: normalized })
        });
      } catch (e) {
        console.warn('Could not save payers to clinic database:', e);
      }
    }

    function matchPayerDirectory(carrierName) {
      if (!carrierName || typeof carrierName !== 'string') return null;
      const c = carrierName.toLowerCase().trim();
      if (!c || /^(none|n\/a|na|-|dental insurance)$/i.test(c)) return null;
      const list = getPayerDirectory();

      // 1. Exact case-insensitive name/carrier match first
      const exact = list.find(p =>
        (p.name && p.name.toLowerCase().trim() === c) ||
        (p.carrier && p.carrier.toLowerCase().trim() === c)
      );
      if (exact) return exact;

      // 2. Exact matchKey match
      for (const p of list) {
        if (Array.isArray(p.matchKeys)) {
          for (const k of p.matchKeys) {
            if (String(k || '').toLowerCase().trim() === c) return p;
          }
        }
      }

      // 3. Substring match (skip generic 'delta dental' if a more specific Delta entry might exist)
      for (const p of list) {
        if (p.name && c.includes(p.name.toLowerCase().trim())) return p;
        if (Array.isArray(p.matchKeys)) {
          for (const k of p.matchKeys) {
            const kLower = String(k || '').toLowerCase().trim();
            if (!kLower) continue;
            if (kLower === 'delta dental' && c !== 'delta dental' && !c.includes('ppo') && !c.includes('national')) {
              continue;
            }
            if (c.includes(kLower)) return p;
          }
        }
      }
      return null;
    }

    async function syncBreakdownInsuranceToDirectory(details, oldCarrier = '') {
      if (!details || !details.carrier) return;
      const rawCarrier = String(details.carrier || '').trim();
      if (!rawCarrier || /^(none|n\/a|na|-|dental insurance)$/i.test(rawCarrier)) return;

      const list = getPayerDirectory().slice();
      const cLower = rawCarrier.toLowerCase();
      const oldLower = String(oldCarrier || '').toLowerCase().trim();

      let target = list.find(p =>
        (p.name && p.name.toLowerCase().trim() === cLower) ||
        (p.carrier && p.carrier.toLowerCase().trim() === cLower)
      );

      if (!target && oldLower && oldLower === cLower) {
        target = matchPayerDirectory(rawCarrier);
      }

      const rawAddr = String(details.insurance_address || '').trim();
      const hasValidAddr = rawAddr && !/^(none|n\/a|na|-)$/i.test(rawAddr) && !/1605\s+johnson\s+pl/i.test(rawAddr);
      const rawPid = String(details.payor_id || '').trim();
      const hasValidPid = rawPid && !/^(none|n\/a|na|-)$/i.test(rawPid);
      const rawPhone = String(details.insurance_phone || '').trim();
      const hasValidPhone = rawPhone && !/^(none|n\/a|na|-)$/i.test(rawPhone);
      const rawNet = String(details.network_status || '').trim();
      const normNet = rawNet.toLowerCase().includes('out') ? 'Out-of-Network' : 'In-Network';

      if (target) {
        target.name = rawCarrier;
        target.carrier = rawCarrier;
        if (hasValidAddr) target.address = rawAddr;
        if (hasValidPid) target.payorId = rawPid;
        if (hasValidPhone) target.phone = rawPhone;
        if (rawNet) {
          target.network = normNet;
          target.networkStatus = normNet;
        }
        if (!Array.isArray(target.matchKeys)) target.matchKeys = [];
        if (!target.matchKeys.some(k => String(k).toLowerCase() === cLower)) {
          target.matchKeys.push(cLower);
        }
      } else {
        let parentCarrier = 'Standard Carrier';
        if (cLower.includes('delta')) parentCarrier = 'Delta Dental Ins';
        else if (cLower.includes('metlife') || cLower.includes('met life')) parentCarrier = 'MetLife';
        else if (cLower.includes('cigna')) parentCarrier = 'Cigna Healthcare';
        else if (cLower.includes('guardian')) parentCarrier = 'Guardian';
        else if (cLower.includes('aetna')) parentCarrier = 'Aetna';
        else if (cLower.includes('blue cross') || cLower.includes('bcbs') || cLower.includes('anthem')) parentCarrier = 'Blue Cross Blue Shield';

        list.push({
          id: 'payer_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          parentCarrier,
          name: rawCarrier,
          carrier: rawCarrier,
          network: normNet,
          networkStatus: normNet,
          matchKeys: [cLower],
          address: hasValidAddr ? rawAddr : 'N/A',
          phone: hasValidPhone ? rawPhone : 'N/A',
          payorId: hasValidPid ? rawPid : 'N/A',
          isCustom: true,
        });
      }

      await savePayerDirectory(list);
      if (insuranceDirectoryModal && insuranceDirectoryModal.classList.contains('active')) {
        renderDedicatedPayerDirectory();
      }
    }


    // File State
    let selectedFiles = [];

    // History Storage Key
    const HISTORY_STORAGE_KEY = 'dentverify_audit_history';

    // Elements
    const dropzoneField = document.getElementById('dropzoneField');
    const fileInput = document.getElementById('fileInput');
    const filesListContainer = document.getElementById('filesListContainer');
    const filesItemsGrid = document.getElementById('filesItemsGrid');
    const filesCountText = document.getElementById('filesCountText');
    const addMoreFilesBtn = document.getElementById('addMoreFilesBtn');
    const patientNameInput = document.getElementById('patientNameInput');
    const patientDobInput = document.getElementById('patientDobInput');
    const patientHeroBadge = document.getElementById('patientHeroBadge');
    const patientHeroName = document.getElementById('patientHeroName');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const auditorLoading = document.getElementById('auditorLoading');
    const loadingTicker = document.getElementById('loadingTicker');
    const uiAlertError = document.getElementById('uiAlertError');
    const errorTitleText = document.getElementById('errorTitleText');
    const errorDetailsText = document.getElementById('errorDetailsText');
    const retryVerifyBtn = document.getElementById('retryVerifyBtn');
    const dismissAlertBtn = document.getElementById('dismissAlertBtn');
    const reportDashboard = document.getElementById('reportDashboard');
    const newVerificationBtn = document.getElementById('newVerificationBtn');
    const loadSampleBtn = document.getElementById('loadSampleBtn');

    // History Modal elements
    const historyModal = document.getElementById('historyModal');
    const openHistoryBtn = document.getElementById('openHistoryBtn');
    const closeHistoryModalBtn = document.getElementById('closeHistoryModalBtn');
    const btnCloseHistoryFooterBtn = document.getElementById('btnCloseHistoryFooterBtn');
    const btnClearHistoryBtn = document.getElementById('btnClearHistoryBtn');
    const historyListContainer = document.getElementById('historyListContainer');
    const headerHistoryCount = document.getElementById('headerHistoryCount');
    const historyModalCount = document.getElementById('historyModalCount');
    const historySearchInput = document.getElementById('historySearchInput');

    // Staff Auth & Session Elements
    const openAuthModalBtn = document.getElementById('openAuthModalBtn');
    const userBadgeLabel = document.getElementById('userBadgeLabel');
    const authModal = document.getElementById('authModal');
    const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
    const btnCloseAuthModalBtn = document.getElementById('btnCloseAuthModalBtn');
    const authLoggedInView = document.getElementById('authLoggedInView');
    const authSessionUserName = document.getElementById('authSessionUserName');
    const authSessionUserEmail = document.getElementById('authSessionUserEmail');
    const authSessionPracticeName = document.getElementById('authSessionPracticeName');
    const btnLogoutStaff = document.getElementById('btnLogoutStaff');
    const authLoginForm = document.getElementById('authLoginForm');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginErrorMsg = document.getElementById('loginErrorMsg');
    const btnSubmitLogin = document.getElementById('btnSubmitLogin');

    // HIPAA Inactivity Modal Elements
    const inactivityWarningModal = document.getElementById('inactivityWarningModal');
    const inactivityCountdownSec = document.getElementById('inactivityCountdownSec');
    const stayLoggedInBtn = document.getElementById('stayLoggedInBtn');
    const logoutNowBtn = document.getElementById('logoutNowBtn');

    // Table elements
    const cdtSearchInput = document.getElementById('cdtSearchInput');
    const filterChips = document.querySelectorAll('.filter-chip');
    const cdtTableBody = document.getElementById('cdtTableBody');
    const codesCountPill = document.getElementById('codesCountPill');

    // PMS Modal elements
    const pmsModal = document.getElementById('pmsModal');
    const openPmsModalBtn = document.getElementById('openPmsModalBtn');
    const closePmsModalBtn = document.getElementById('closePmsModalBtn');
    const pmsNoteContent = document.getElementById('pmsNoteContent');
    const copyPmsNoteBtn = document.getElementById('copyPmsNoteBtn');
    const toastPill = document.getElementById('toastPill');
    const toastPillMessage = document.getElementById('toastPillMessage');

    // Drag and drop handlers
    ['dragenter', 'dragover'].forEach(name => {
      dropzoneField.addEventListener(name, (e) => {
        e.preventDefault();
        dropzoneField.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzoneField.addEventListener(name, (e) => {
        e.preventDefault();
        dropzoneField.classList.remove('dragover');
      });
    });

    dropzoneField.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleIncomingFiles(Array.from(e.dataTransfer.files));
      }
    });

    dropzoneField.addEventListener('click', () => {
      fileInput.click();
    });

    addMoreFilesBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleIncomingFiles(Array.from(e.target.files));
      }
      fileInput.value = ''; // Reset so the same file can be re-selected if removed
    });

    function formatFileSize(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function handleIncomingFiles(newFiles) {
      hideAlert();
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

      for (const f of newFiles) {
        if (!validTypes.includes(f.type) && !/\.(pdf|png|jpe?g|webp)$/i.test(f.name)) {
          showAlert(`"${f.name}" is not a supported format. Please use PDF, PNG, JPG, or WEBP.`);
          continue;
        }

        // Check if already added
        const exists = selectedFiles.some(existing => existing.name === f.name && existing.size === f.size);
        if (!exists) {
          if (selectedFiles.length >= 10) {
            showAlert('Maximum 10 files allowed at once.');
            break;
          }
          selectedFiles.push(f);
        }
      }

      renderFilesList();
    }

    function renderFilesList() {
      if (selectedFiles.length === 0) {
        filesListContainer.classList.remove('active');
        dropzoneField.style.display = 'block';
        return;
      }

      filesListContainer.classList.add('active');
      dropzoneField.style.display = 'none';

      const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
      filesCountText.textContent = `${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''} Attached (${formatFileSize(totalSize)})`;

      filesItemsGrid.innerHTML = '';
      selectedFiles.forEach((file, index) => {
        const ext = file.name.split('.').pop().toUpperCase().slice(0, 4) || 'DOC';
        
        const row = document.createElement('div');
        row.className = 'file-item-row';
        row.innerHTML = `
          <div class="file-item-left">
            <div class="file-item-badge">${escapeHtml(ext)}</div>
            <div class="file-item-info">
              <div class="file-item-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
              <div class="file-item-meta">${formatFileSize(file.size)} • Page/File #${index + 1}</div>
            </div>
          </div>
          <button type="button" class="btn-icon-danger remove-single-file-btn" data-index="${index}" title="Remove this file">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        `;

        const removeBtn = row.querySelector('.remove-single-file-btn');
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          selectedFiles.splice(index, 1);
          renderFilesList();
        });

        filesItemsGrid.appendChild(row);
      });
    }

    // Loading ticker animation
    let loadingTickerTimer = null;
    const tickerSteps = [
      'Extracting document text & tabular grids...',
      'Auditing network benefit tier (In vs Out of Network)...',
      'Calculating annual maximums & individual deductibles...',
      'Exhaustively mapping CDT procedure codes (D0100 - D9999)...',
      'Evaluating frequency limitations & history dates...',
      'Validating amalgam downgrade clauses & tooth exclusions...',
      'Finalizing clinical PMS note formatting...'
    ];

    function startAuditorLoading() {
      auditorLoading.classList.add('active');
      analyzeBtn.disabled = true;
      hideAlert();
      let stepIndex = 0;
      loadingTicker.textContent = tickerSteps[0];
      loadingTickerTimer = setInterval(() => {
        stepIndex = (stepIndex + 1) % tickerSteps.length;
        loadingTicker.textContent = tickerSteps[stepIndex];
      }, 2200);
    }

    function stopAuditorLoading() {
      auditorLoading.classList.remove('active');
      analyzeBtn.disabled = false;
      if (loadingTickerTimer) clearInterval(loadingTickerTimer);
    }

    function showAlert(msg, title = 'Verification Notice') {
      if (typeof msg === 'object' && msg !== null) {
        title = msg.title || title;
        msg = msg.message || JSON.stringify(msg);
      }
      if (errorTitleText) errorTitleText.textContent = title;
      if (errorDetailsText) errorDetailsText.textContent = msg;
      uiAlertError.classList.add('active');
    }

    function hideAlert() {
      uiAlertError.classList.remove('active');
    }

    if (retryVerifyBtn) {
      retryVerifyBtn.addEventListener('click', () => {
        hideAlert();
        analyzeBtn.click();
      });
    }

    if (dismissAlertBtn) {
      dismissAlertBtn.addEventListener('click', () => {
        hideAlert();
      });
    }

    function displayToast(msg) {
      toastPillMessage.textContent = msg;
      toastPill.classList.add('show');
      setTimeout(() => {
        toastPill.classList.remove('show');
      }, 3000);
    }

    // ==========================================
    // CUSTOM DENTVERIFY UI DIALOG ENGINE (100% Custom UI — No Browser prompt/confirm/alert)
    // ==========================================
    const customDialogModal = document.getElementById('customDialogModal');
    const customDialogTitleText = document.getElementById('customDialogTitleText');
    const customDialogMessage = document.getElementById('customDialogMessage');
    const customDialogInputWrap = document.getElementById('customDialogInputWrap');
    const customDialogInput = document.getElementById('customDialogInput');
    const customDialogError = document.getElementById('customDialogError');
    const customDialogCancelBtn = document.getElementById('customDialogCancelBtn');
    const customDialogConfirmBtn = document.getElementById('customDialogConfirmBtn');
    const customDialogCloseBtn = document.getElementById('customDialogCloseBtn');

    function openCustomDialog({
      title = 'DentVerify',
      message = '',
      mode = 'prompt', // 'prompt' | 'confirm' | 'notice'
      defaultValue = '',
      inputType = 'text',
      placeholder = '',
      confirmText = 'Save',
      cancelText = 'Cancel',
      validate = null,
    }) {
      return new Promise((resolve) => {
        if (!customDialogModal) {
          resolve(null);
          return;
        }
        if (customDialogTitleText) customDialogTitleText.textContent = title;
        if (customDialogMessage) customDialogMessage.textContent = message;
        if (customDialogError) {
          customDialogError.style.display = 'none';
          customDialogError.textContent = '';
        }

        if (mode === 'prompt') {
          if (customDialogInputWrap) customDialogInputWrap.style.display = 'block';
          if (customDialogInput) {
            customDialogInput.type = inputType;
            customDialogInput.value = defaultValue ?? '';
            customDialogInput.placeholder = placeholder || '';
          }
          if (customDialogCancelBtn) {
            customDialogCancelBtn.style.display = 'inline-flex';
            customDialogCancelBtn.textContent = cancelText;
          }
          if (customDialogConfirmBtn) customDialogConfirmBtn.textContent = confirmText;
        } else if (mode === 'confirm') {
          if (customDialogInputWrap) customDialogInputWrap.style.display = 'none';
          if (customDialogCancelBtn) {
            customDialogCancelBtn.style.display = 'inline-flex';
            customDialogCancelBtn.textContent = cancelText;
          }
          if (customDialogConfirmBtn) customDialogConfirmBtn.textContent = confirmText || 'Confirm';
        } else {
          // 'notice'
          if (customDialogInputWrap) customDialogInputWrap.style.display = 'none';
          if (customDialogCancelBtn) customDialogCancelBtn.style.display = 'none';
          if (customDialogConfirmBtn) customDialogConfirmBtn.textContent = confirmText || 'OK';
        }

        customDialogModal.classList.add('active');
        if (mode === 'prompt' && customDialogInput) {
          setTimeout(() => {
            customDialogInput.focus();
            customDialogInput.select();
          }, 40);
        }

        function cleanup() {
          customDialogModal.classList.remove('active');
          if (customDialogConfirmBtn) customDialogConfirmBtn.onclick = null;
          if (customDialogCancelBtn) customDialogCancelBtn.onclick = null;
          if (customDialogCloseBtn) customDialogCloseBtn.onclick = null;
          if (customDialogInput) customDialogInput.onkeydown = null;
        }

        function handleConfirm() {
          if (mode === 'prompt') {
            const val = customDialogInput ? customDialogInput.value : '';
            if (typeof validate === 'function') {
              const errMsg = validate(val);
              if (errMsg) {
                if (customDialogError) {
                  customDialogError.textContent = errMsg;
                  customDialogError.style.display = 'block';
                }
                return;
              }
            }
            cleanup();
            resolve(val);
          } else {
            cleanup();
            resolve(true);
          }
        }

        function handleCancel() {
          cleanup();
          resolve(mode === 'prompt' ? null : false);
        }

        if (customDialogConfirmBtn) customDialogConfirmBtn.onclick = handleConfirm;
        if (customDialogCancelBtn) customDialogCancelBtn.onclick = handleCancel;
        if (customDialogCloseBtn) customDialogCloseBtn.onclick = handleCancel;
        if (customDialogInput) {
          customDialogInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirm();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              handleCancel();
            }
          };
        }
      });
    }

    function openCustomPrompt(title, message, defaultValue = '', options = {}) {
      return openCustomDialog({
        title,
        message,
        mode: 'prompt',
        defaultValue,
        inputType: options.inputType || 'text',
        placeholder: options.placeholder || '',
        confirmText: options.confirmText || 'Save Changes',
        cancelText: options.cancelText || 'Cancel',
        validate: options.validate || null,
      });
    }

    function openCustomConfirm(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
      return openCustomDialog({
        title,
        message,
        mode: 'confirm',
        confirmText,
        cancelText,
      });
    }

    function openCustomNotice(title, message, confirmText = 'OK') {
      return openCustomDialog({
        title,
        message,
        mode: 'notice',
        confirmText,
      });
    }

    // Demo Sample Trigger
    loadSampleBtn.addEventListener('click', () => {
      hideAlert();
      currentAuditData = JSON.parse(JSON.stringify(SAMPLE_BREAKDOWN_DATA));
      const enteredName = patientNameInput ? patientNameInput.value.trim() : '';
      if (enteredName) {
        currentAuditData.insurance_details.patient_name = enteredName;
      }
      renderReportDashboard(currentAuditData);
      // Sample breakdown is intentionally NOT saved to history
      displayToast('Loaded sample Delta Dental breakdown.');
    });

    // Reset Verification and Form State without reloading page
    function resetVerificationState() {
      selectedFiles = [];
      currentAuditData = null;
      if (fileInput) fileInput.value = '';
      if (patientNameInput) patientNameInput.value = '';
      if (patientDobInput) patientDobInput.value = '';
      if (filesListContainer) filesListContainer.classList.remove('active');
      if (dropzoneField) dropzoneField.style.display = 'block';

      // Hide Report Dashboard (IV Information)
      if (reportDashboard) {
        reportDashboard.classList.remove('active');
        reportDashboard.style.display = 'none';
      }

      // Show Upload Form and Hero section
      const heroSec = document.querySelector('.hero-section');
      if (heroSec) heroSec.style.display = 'flex';
      const formPan = document.getElementById('formPanel');
      if (formPan) formPan.style.display = 'block';

      if (patientHeroBadge) patientHeroBadge.style.display = 'none';
      hideAlert();
      stopAuditorLoading();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 7-Day (Weekly) Duplicate Patient Verification Check Helper
    function findRecentPatientDuplicateWithin7Days(nameStr, excludeId = null) {
      if (!nameStr || typeof nameStr !== 'string') return null;
      const cleanTarget = nameStr.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!cleanTarget || /^(none|n\/a|na|-|patient|patient \(unspecified\)|katherine birdwell)$/i.test(cleanTarget)) {
        return null;
      }
      const list = getAuditHistory();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      for (const item of list) {
        if (!item || !item.patientName) continue;
        if (excludeId && item.id === excludeId) continue;
        const itemClean = String(item.patientName).trim().toLowerCase().replace(/\s+/g, ' ');
        if (itemClean === cleanTarget) {
          const ts = item.timestamp ? new Date(item.timestamp).getTime() : 0;
          if (ts > 0 && (now - ts) <= sevenDaysMs) {
            return item;
          }
        }
      }
      return null;
    }

    async function loadExistingDuplicateRecord(dupItem) {
      if (!dupItem) return;
      try {
        if (!dupItem.data && (dupItem.isDbRecord || (typeof dupItem.id === 'string' && dupItem.id.includes('-')))) {
          const res = await fetch(`/api/verifications/${dupItem.id}`);
          const json = await res.json();
          if (json.success && json.record) {
            dupItem.data = json.record;
          }
        }
        if (dupItem.data) {
          currentAuditData = dupItem.data;
          renderReportDashboard(currentAuditData);
          displayToast(`Loaded existing breakdown for ${dupItem.patientName} (${dupItem.displayDate})`);
        }
      } catch (e) {
        console.warn('Could not load existing duplicate record:', e);
      }
    }

    // Form submission
    analyzeBtn.addEventListener('click', async () => {
      hideAlert();

      if (selectedFiles.length === 0) {
        showAlert('Palihug pag-upload o pag-drag ug dental breakdown file (PDF o Image) sa dili pa mag-analyze.', 'Wala pay File Gi-upload');
        return;
      }

      const pref = document.querySelector('input[name="network_preference"]:checked')?.value || 'auto';
      const patientNameVal = patientNameInput ? patientNameInput.value.trim() : '';
      const patientDobVal = patientDobInput ? patientDobInput.value.trim() : '';

      // 7-Day (Weekly) Duplicate Patient Verification Check before calling AI
      if (patientNameVal) {
        const recentDup = findRecentPatientDuplicateWithin7Days(patientNameVal);
        if (recentDup) {
          const verifyNewAnyway = await openCustomConfirm(
            '⚠️ Na-Verify Na Sulod sa 7 Ka Adlaw (Weekly Duplicate Check)',
            `Si "${recentDup.patientName}" na-verify na niadtong ${recentDup.displayDate} (${recentDup.carrier} • ${recentDup.networkStatus || 'In-Network'}).\n\nSulod sa 1 ka semana (7 days), dili na kinahanglan i-verify og balik gawas kung lahi nga insurance. Gusto ba nimo ablihan na lang ang existing breakdown o mag-verify gihapon og bag-o?`,
            'Verify New Anyway',
            'Open Existing Breakdown'
          );
          if (!verifyNewAnyway) {
            await loadExistingDuplicateRecord(recentDup);
            return;
          }
        }
      }

      const formData = new FormData();
      
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('network_preference', pref);
      if (patientNameVal) {
        formData.append('patient_name', patientNameVal);
      }
      if (patientDobVal) {
        formData.append('dob', patientDobVal);
      }

      // Append customized AI role or CDT prompt from settings if configured
      const customSys = localStorage.getItem('dentverify_system_instruction') || (settingSystemInstruction ? settingSystemInstruction.value.trim() : '');
      const customPr = localStorage.getItem('dentverify_custom_prompt') || (settingCustomPrompt ? settingCustomPrompt.value.trim() : '');
      if (customSys) formData.append('system_instruction', customSys);
      if (customPr) formData.append('custom_prompt', customPr);

      startAuditorLoading();

      try {
        const response = await fetch('/api/verify', {
          method: 'POST',
          body: formData,
        });

        let resData = null;
        let isJson = false;
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          try {
            resData = await response.json();
            isJson = true;
          } catch (jsonErr) {
            console.error('Error parsing JSON from server:', jsonErr);
          }
        }

        // If HTTP status is not successful (e.g. 504 Timeout, 503 Overload, 502, 429, 500)
        if (!response.ok) {
          if (resData && resData.error) {
            let errorTitle = 'AI Verification Notice';
            if (resData.error_type === 'API_OVERLOAD') {
              errorTitle = '⚠️ Google Gemini API Overload (503 High Demand)';
            } else if (resData.error_type === 'RATE_LIMIT') {
              errorTitle = '⚠️ Gemini Free Quota / Rate Limit (429)';
            } else if (resData.error_type === 'TIMEOUT') {
              errorTitle = '⏱️ Processing Timeout';
            } else if (resData.error_type === 'AUTH_ERROR') {
              errorTitle = '⚠️ Gemini API Key Issue (403)';
            }
            showAlert(resData.error, errorTitle);
            return;
          }

          // If server or Nginx returned an HTML error page without JSON
          if (response.status === 504) {
            showAlert('Nadugay pag-proseso ang Google Gemini tungod sa kadako sa dokumento o temporaryong taas nga trapik sa Google network. Dili kinahanglan i-reload ang panid — i-click lang ang "Sulayi Pag-usab" sa ubos.', '⏱️ 504 Gateway Timeout (Gemini AI Busy)');
            return;
          } else if (response.status === 503) {
            showAlert('Temporaryong taas kaayo ang demand sa Google Gemini AI karon (Global demand spike). Palihug paghulat og 5-10 segundos unya i-click ang "Sulayi Pag-usab".', '⚠️ 503 Gemini API Overload');
            return;
          } else if (response.status === 429) {
            showAlert('Nalapas ang libreng request limit sa Gemini API key karon. Palihug pahuwayi kadiyot (1-2 minutos) sa dili pa mosulay pag-usab.', '⚠️ 429 Rate Limit Reached');
            return;
          } else if (response.status === 502) {
            showAlert('Ang server nag-restart o temporaryong busy. Palihug paghulat og 5 ka segundo unya i-click ang "Sulayi Pag-usab".', '🔌 502 Bad Gateway');
            return;
          } else if (response.status === 413) {
            showAlert('Dako ra kaayo ang gi-upload nga file (maximum 30MB). Palihug pag-upload og mas gamay nga file o bahina ang mga pahina.', '📁 413 File Too Large');
            return;
          } else {
            showAlert(`Adunay problema sa server (HTTP Status ${response.status}). Palihug i-click ang "Sulayi Pag-usab".`, `⚠️ Server Error (${response.status})`);
            return;
          }
        }

        if (!resData || !resData.success) {
          showAlert(resData?.error || 'Wala nagmalampuson ang insurance verification. Palihug sulayi pag-usab.', 'Verification Notice');
          return;
        }

        currentAuditData = resData.data;

        // If user explicitly entered a patient name or DOB on the form, keep it
        if (patientNameVal && (!currentAuditData.insurance_details.patient_name || currentAuditData.insurance_details.patient_name === 'N/A')) {
          currentAuditData.insurance_details.patient_name = patientNameVal;
        }
        if (patientDobVal && (!currentAuditData.insurance_details.dob || currentAuditData.insurance_details.dob === 'N/A')) {
          currentAuditData.insurance_details.dob = patientDobVal;
        }

        if (resData.meta && resData.meta.verification_id) {
          currentAuditData.verification_id = resData.meta.verification_id;
        }

        // If patient name wasn't typed upfront, check if extracted patient name was already verified within 7 days
        const extractedPName = currentAuditData?.insurance_details?.patient_name || '';
        const postDup = !patientNameVal ? findRecentPatientDuplicateWithin7Days(extractedPName, currentAuditData.verification_id) : null;

        renderReportDashboard(currentAuditData);
        saveAuditToHistory(currentAuditData);

        if (postDup) {
          const keepNew = await openCustomConfirm(
            '⚠️ Duplicate Patient Detected (Verified Within Last 7 Days)',
            `Si "${postDup.patientName}" naa nay existing verification niadtong ${postDup.displayDate} (${postDup.carrier}).\n\nGusto ba nimo ablihan ang naunang breakdown o magpabilin niining bag-ong gi-verify?`,
            'Keep New Breakdown',
            'Open Previous Breakdown'
          );
          if (!keepNew) {
            await loadExistingDuplicateRecord(postDup);
          }
        }
      } catch (err) {
        console.error('Audit verification error:', err);
        let errorMsg = err.message || 'Adunay problema sa pagkonektar sa server.';
        let errorTitle = 'Network / Server Error';

        if (errorMsg.includes('Unexpected token') || errorMsg.includes('JSON')) {
          errorTitle = '⚠️ API Overload / Gateway Timeout (504)';
          errorMsg = 'Nakadawat ang browser og HTML imbes JSON gikan sa server. Kasagaran kini mahitabo kung nag-timeout o busy ang Google Gemini API sa pag-proseso sa file. Dili kinahanglan i-reload ang panid — i-click lang ang "Sulayi Pag-usab" button sa ubos!';
        }

        showAlert(errorMsg, errorTitle);
      } finally {
        stopAuditorLoading();
      }
    });

    // Money formatter
    function fmtMoney(amount) {
      if (amount === null || amount === undefined) return 'Unlimited';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
    }

    // Format Appointment Readiness Status Pill
    function applyReadinessBadgeStyle(btnEl, statusStr) {
      if (!btnEl) return;
      const s = String(statusStr || 'Complete / Ready for Appointment');
      if (s.toLowerCase().includes('pending')) {
        btnEl.textContent = '⏳ Pending Carrier Call / Fax History';
        btnEl.style.background = 'rgba(245, 158, 11, 0.16)';
        btnEl.style.color = '#fbbf24';
        btnEl.style.border = '1px solid rgba(245, 158, 11, 0.45)';
      } else if (s.toLowerCase().includes('term') || s.toLowerCase().includes('inact')) {
        btnEl.textContent = '❌ Policy Termed / Inactive';
        btnEl.style.background = 'rgba(244, 63, 94, 0.16)';
        btnEl.style.color = '#fb7185';
        btnEl.style.border = '1px solid rgba(244, 63, 94, 0.45)';
      } else {
        btnEl.textContent = '✅ Complete / Ready for Appointment';
        btnEl.style.background = 'rgba(16, 185, 129, 0.16)';
        btnEl.style.color = '#34d399';
        btnEl.style.border = '1px solid rgba(16, 185, 129, 0.45)';
      }
    }

    // Render verification report
    function renderReportDashboard(data) {
      if (data) {
        if (data.insurance_details) {
          data.insurance_details = enforcePolicyTermedRules(data.insurance_details);
        }
        if (Array.isArray(data.procedure_codes)) {
          data.procedure_codes = enforceCanonicalCdtMeanings(data.procedure_codes);
          data.procedure_codes = enforceSharedFmxPanoRules(data.procedure_codes);
          data.procedure_codes = enforceAgeLimitAndFrequencyRules(data.procedure_codes, data.insurance_details || {});
        }
      }
      const details = data.insurance_details || {};
      const levels = data.coverage_levels || {};

      // Auto-populate & enforce Locked Claims Address, Payor ID, Phone, Pre-Set Network Status & Pre-Set Fee Schedule from Wired Hub Directory
      if (details.carrier) {
        const matchedPayer = matchPayerDirectory(details.carrier);
        if (matchedPayer) {
          if (matchedPayer.address && !/^(none|n\/a|na|-)$/i.test(matchedPayer.address.trim())) {
            details.insurance_address = matchedPayer.address;
          }
          if (matchedPayer.phone && !/^(none|n\/a|na|-)$/i.test(matchedPayer.phone.trim())) {
            details.insurance_phone = matchedPayer.phone;
          }
          if (matchedPayer.payorId && !/^(none|n\/a|na|-)$/i.test(matchedPayer.payorId.trim())) {
            details.payor_id = matchedPayer.payorId;
          }
          if (matchedPayer.network) {
            details.network_status = matchedPayer.network;
          }
          if (matchedPayer.feeSchedule && !/^(none|n\/a|na|-)$/i.test(matchedPayer.feeSchedule.trim())) {
            if (!details.fee_schedule || /^(none|n\/a|na|-|delta dental ppo)$/i.test(details.fee_schedule.trim())) {
              details.fee_schedule = matchedPayer.feeSchedule.trim();
            }
          }
        } else if (details.insurance_address && details.insurance_address !== 'N/A') {
          // Reject patient residential street addresses (e.g. MetLife bug) that lack P.O. Box / Claims keywords
          if (!/\b(p\.?\s*o\.?\s*box|box\s+\d+|claims|dept|department)\b/i.test(details.insurance_address)) {
            details.insurance_address = 'N/A';
          }
        }
      }

      // Initialize & Render "Verified By" Staff Audit Stamp + Appointment Readiness Status Tag
      if (!data.audit_meta) {
        const isPolTermed = String(details.policy_status || '').toLowerCase().includes('term');
        data.audit_meta = {
          verified_by_name: currentUser?.full_name || 'Clinic Staff',
          verified_at: new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          readiness_status: isPolTermed ? 'Policy Termed / Inactive' : 'Complete / Ready for Appointment',
        };
      }
      const heroVerifiedByDisplay = document.getElementById('heroVerifiedByDisplay');
      if (heroVerifiedByDisplay) {
        heroVerifiedByDisplay.textContent = data.audit_meta.verified_by_name || currentUser?.full_name || 'Clinic Staff';
      }
      const heroVerifiedAtDisplay = document.getElementById('heroVerifiedAtDisplay');
      if (heroVerifiedAtDisplay) {
        heroVerifiedAtDisplay.textContent = data.audit_meta.verified_at || new Date().toLocaleDateString('en-US');
      }
      const heroReadinessStatusBtn = document.getElementById('heroReadinessStatusBtn');
      if (heroReadinessStatusBtn) {
        applyReadinessBadgeStyle(heroReadinessStatusBtn, data.audit_meta.readiness_status);
        heroReadinessStatusBtn.onclick = () => {
          if (!currentAuditData) return;
          if (!currentAuditData.audit_meta) currentAuditData.audit_meta = {};
          const cur = String(currentAuditData.audit_meta.readiness_status || 'Complete / Ready for Appointment');
          let nextStatus = 'Complete / Ready for Appointment';
          if (cur.toLowerCase().includes('complete')) {
            nextStatus = 'Pending Carrier Call / Fax History';
          } else if (cur.toLowerCase().includes('pending')) {
            nextStatus = 'Policy Termed / Inactive';
          } else {
            nextStatus = 'Complete / Ready for Appointment';
          }
          currentAuditData.audit_meta.readiness_status = nextStatus;
          applyReadinessBadgeStyle(heroReadinessStatusBtn, nextStatus);
          renderExcelBreakdownSheet(currentAuditData);
          if (pmsModal && pmsModal.classList.contains('active')) buildPmsNote();
          persistActiveBreakdownToDb();
          displayToast(`Appointment Readiness set to: ${nextStatus}`);
        };
      }

      // Patient Name & DOB Display
      const pDob = details.dob && details.dob !== 'N/A' && details.dob !== 'None' ? details.dob : '';
      const pAge = pDob ? calculateAge(pDob) : null;

      const heroPatientNameDisplay = document.getElementById('heroPatientNameDisplay');
      if (heroPatientNameDisplay) {
        heroPatientNameDisplay.textContent = (details.patient_name && details.patient_name.trim() !== '' && !/^(none|n\/a|na|-)$/i.test(details.patient_name.trim())) ? details.patient_name.trim() : 'N/A';
      }

      const heroPatientDobDisplay = document.getElementById('heroPatientDobDisplay');
      if (heroPatientDobDisplay) {
        heroPatientDobDisplay.textContent = pDob ? `DOB: ${pDob}${pAge !== null ? ` (Age: ${pAge})` : ''}` : 'DOB: Not Specified';
      }

      if (patientHeroBadge && patientHeroName) {
        if (details.patient_name && details.patient_name.trim() !== '' && !/^(none|n\/a|na|-)$/i.test(details.patient_name.trim())) {
          patientHeroName.textContent = details.patient_name.trim();
          patientHeroBadge.style.display = 'inline-flex';
        } else {
          patientHeroBadge.style.display = 'none';
        }
      }

      // Employer / Group Name, Plan Name & Group #
      const grp = (details.group_name && details.group_name.trim() !== '' && !/^(none|n\/a|na|-)$/i.test(details.group_name.trim())) ? details.group_name.trim() : '';
      const pln = (details.plan_name && details.plan_name.trim() !== '' && !/^(none|n\/a|na|-)$/i.test(details.plan_name.trim())) ? details.plan_name.trim() : '';

      let groupPlanDisplay = 'N/A';
      if (grp && pln && grp.toLowerCase() !== pln.toLowerCase()) {
        groupPlanDisplay = `${grp} • ${pln}`;
      } else if (grp) {
        groupPlanDisplay = grp;
      } else if (pln) {
        groupPlanDisplay = pln;
      }

      const heroGroupNameDisplay = document.getElementById('heroGroupNameDisplay');
      if (heroGroupNameDisplay) {
        heroGroupNameDisplay.textContent = groupPlanDisplay;
      }

      const heroGroupNumberDisplay = document.getElementById('heroGroupNumberDisplay');
      const grpNum = (details.group_number && details.group_number.trim() !== '' && !/^(none|n\/a|na|-)$/i.test(details.group_number.trim())) ? details.group_number.trim() : 'N/A';
      if (heroGroupNumberDisplay) {
        heroGroupNumberDisplay.textContent = `Group #: ${grpNum}`;
      }

      // Carrier Name in Top Banner (Locked to Insurance Hub Directory)
      const carrierNameDisplay = document.getElementById('carrierNameDisplay');
      if (carrierNameDisplay) carrierNameDisplay.textContent = details.carrier || 'Dental Insurance';

      const carrierAddressDisplay = document.getElementById('carrierAddressDisplay');
      if (carrierAddressDisplay) {
        carrierAddressDisplay.textContent = '';
        carrierAddressDisplay.style.display = 'none';
      }

      const planEffectiveDateDisplay = document.getElementById('planEffectiveDateDisplay');
      if (planEffectiveDateDisplay) planEffectiveDateDisplay.textContent = 'Effective: ' + (details.effective_date || '01/01/2026');
      
      const netBadge = document.getElementById('networkStatusBadge');
      const heroNetBadge = document.getElementById('heroNetworkBadge');
      const netStatus = details.network_status || 'In Network';
      
      if (netBadge) {
        netBadge.textContent = netStatus;
        netBadge.className = netStatus.toLowerCase().includes('out') ? 'network-indicator-pill out-network' : 'network-indicator-pill in-network';
      }
      if (heroNetBadge) {
        heroNetBadge.textContent = netStatus;
        heroNetBadge.className = netStatus.toLowerCase().includes('out') ? 'network-indicator-pill out-network' : 'network-indicator-pill in-network';
        heroNetBadge.title = `Pre-set by Clinic Insurance Hub (Click to switch Hub or toggle)`;

        if (!heroNetBadge.dataset.listenerAttached) {
          heroNetBadge.dataset.listenerAttached = 'true';
          heroNetBadge.addEventListener('click', () => {
            if (!currentAuditData || !currentAuditData.insurance_details) return;
            const curNet = currentAuditData.insurance_details.network_status || 'In-Network';
            const newNet = curNet.toLowerCase().includes('out') ? 'In-Network' : 'Out-of-Network';
            currentAuditData.insurance_details.network_status = newNet;

            renderReportDashboard(currentAuditData);
            renderExcelBreakdownSheet(currentAuditData);
            if (pmsModal && pmsModal.classList.contains('active')) buildPmsNote();
            persistActiveBreakdownToDb();
            displayToast(`Network status toggled to: ${newNet}`);
          });
        }
      }

      const heroCarrierSubDisplay = document.getElementById('heroCarrierSubDisplay');
      if (heroCarrierSubDisplay) {
        heroCarrierSubDisplay.textContent = details.carrier || 'Carrier Verified';
      }

      // Effective & Termed Dates with Status Validation
      const heroEffectiveDateDisplay = document.getElementById('heroEffectiveDateDisplay');
      if (heroEffectiveDateDisplay) {
        heroEffectiveDateDisplay.textContent = details.effective_date || '01/01/2026';
      }

      const heroTermedDateDisplay = document.getElementById('heroTermedDateDisplay');
      if (heroTermedDateDisplay) {
        heroTermedDateDisplay.textContent = `Termed: ${details.termed_date || 'Active (None)'}`;
      }

      const heroPolicyStatusBadge = document.getElementById('heroPolicyStatusBadge');
      if (heroPolicyStatusBadge) {
        const isTermed = (details.policy_status || '').toLowerCase().includes('term');
        heroPolicyStatusBadge.className = isTermed ? 'policy-status-pill termed' : 'policy-status-pill active';
        heroPolicyStatusBadge.textContent = isTermed ? 'Termed' : 'Active';
      }

      // Plan Benefits Type & Reset Schedule
      const planBenefitsDisplay = document.getElementById('planBenefitsDisplay');
      if (planBenefitsDisplay) {
        planBenefitsDisplay.textContent = 'Plan: ' + (details.plan_benefits || 'Calendar Year');
      }

      const heroPlanBenefitsDisplay = document.getElementById('heroPlanBenefitsDisplay');
      if (heroPlanBenefitsDisplay) {
        heroPlanBenefitsDisplay.textContent = details.plan_benefits || 'Calendar Year';
      }

      const isCalendarYearPlan = String(details.plan_benefits || '').toLowerCase().includes('calendar') || !String(details.plan_benefits || '').toLowerCase().includes('contract');
      const heroPlanResetSub = document.getElementById('heroPlanResetSub');
      if (heroPlanResetSub) {
        heroPlanResetSub.textContent = isCalendarYearPlan ? 'Resets Jan 1st' : 'Contract Basis';
      }

      // Fee Schedule
      const feeSchedStr = details.fee_schedule || (details.carrier ? details.carrier + ' PPO' : 'Delta Dental PPO');
      const feeScheduleDisplay = document.getElementById('feeScheduleDisplay');
      if (feeScheduleDisplay) {
        feeScheduleDisplay.textContent = 'Fee: ' + feeSchedStr;
      }
      const heroFeeScheduleDisplay = document.getElementById('heroFeeScheduleDisplay');
      if (heroFeeScheduleDisplay) {
        heroFeeScheduleDisplay.textContent = feeSchedStr;
      }

      // Payment Recipient
      const payToStr = details.payment_recipient || 'Patient or Office';
      const paymentToDisplay = document.getElementById('paymentToDisplay');
      if (paymentToDisplay) {
        paymentToDisplay.textContent = 'Pay To: ' + payToStr;
      }
      const heroPaymentToDisplay = document.getElementById('heroPaymentToDisplay');
      if (heroPaymentToDisplay) {
        heroPaymentToDisplay.textContent = payToStr;
      }

      // Claims Address & Payor ID (Locked to Directory Settings in Compact Grid)
      const heroClaimsAddressDisplay = document.getElementById('heroClaimsAddressDisplay');
      if (heroClaimsAddressDisplay) {
        const addr = (details.insurance_address && !/^(none|n\/a|na|-)$/i.test(details.insurance_address.trim())) ? details.insurance_address.trim() : 'N/A';
        heroClaimsAddressDisplay.textContent = addr;
      }

      const heroPayorIdDisplay = document.getElementById('heroPayorIdDisplay');
      if (heroPayorIdDisplay) {
        const pid = (details.payor_id && !/^(none|n\/a|na|-)$/i.test(details.payor_id.trim())) ? details.payor_id.trim() : 'N/A';
        const ph = (details.insurance_phone && !/^(none|n\/a|na|-)$/i.test(details.insurance_phone.trim())) ? details.insurance_phone.trim() : '';
        let sub = `Payor ID: ${pid}`;
        if (ph) sub += ` • Ph: ${ph}`;
        heroPayorIdDisplay.textContent = sub;
      }

      // Annual Max Card
      document.getElementById('hudAnnualMax').textContent = fmtMoney(details.annual_maximum);
      document.getElementById('hudRemainingMax').textContent = 'Remaining: ' + fmtMoney(details.remaining_maximum);
      
      let maxPct = 0;
      if (details.annual_maximum && details.remaining_maximum !== null && details.remaining_maximum !== undefined) {
        const used = Math.max(0, details.annual_maximum - details.remaining_maximum);
        maxPct = Math.min(100, Math.round((used / details.annual_maximum) * 100));
        document.getElementById('hudMaxPctUsed').textContent = `${maxPct}% used (${fmtMoney(used)})`;
        document.getElementById('meterMaxBar').style.width = `${Math.max(5, 100 - maxPct)}%`;
      } else {
        document.getElementById('hudMaxPctUsed').textContent = 'No usage recorded';
        document.getElementById('meterMaxBar').style.width = '100%';
      }

      // Individual Deductible Card
      document.getElementById('hudDeductible').textContent = fmtMoney(details.deductible_individual);
      if (details.deductible_remaining !== null && details.deductible_remaining !== undefined) {
        document.getElementById('hudRemainingDed').textContent = 'Remaining: ' + fmtMoney(details.deductible_remaining);
        if (details.deductible_remaining === 0) {
          document.getElementById('hudDedMetStatus').textContent = '100% Met';
          document.getElementById('meterDedBar').style.width = '100%';
        } else {
          document.getElementById('hudDedMetStatus').textContent = 'Active Balance';
          document.getElementById('meterDedBar').style.width = '35%';
        }
      } else {
        document.getElementById('hudRemainingDed').textContent = 'Remaining: $0 (Met or None)';
        document.getElementById('hudDedMetStatus').textContent = 'Met / N/A';
        document.getElementById('meterDedBar').style.width = '100%';
      }

      // Deductible Scope Card
      document.getElementById('hudDedApplies').textContent = details.deductible_applies_to || 'Basic & Major Services';
      const prevCounts = Boolean(details.preventive_applies_to_max);
      document.getElementById('chipPrevMaxDot').className = prevCounts ? 'rule-status-circle warn' : 'rule-status-circle good';
      document.getElementById('chipPrevMaxText').textContent = prevCounts ? 'Prev counts toward annual max' : 'Preventive does NOT apply to max';

      // Orthodontics Card in policy-hero-card (with Ortho Payment Terms)
      const oMaxStr = levels.ortho_max || '$1,000';
      const oRemStr = levels.ortho_remaining || '$999';
      const oAgeStr = levels.ortho_age_limit || '26';
      const oCovStr = levels.ortho || '50%';
      const oPayTermsStr = levels.ortho_payment_terms || 'Monthly';

      const hudOrthoMaxEl = document.getElementById('hudOrthoMax');
      if (hudOrthoMaxEl) hudOrthoMaxEl.textContent = oMaxStr;

      const hudOrthoRemEl = document.getElementById('hudOrthoRem');
      if (hudOrthoRemEl) hudOrthoRemEl.textContent = 'Ortho Rem: ' + oRemStr;

      const hudOrthoAgeLimitEl = document.getElementById('hudOrthoAgeLimit');
      if (hudOrthoAgeLimitEl) hudOrthoAgeLimitEl.textContent = 'Age limit: ' + oAgeStr;

      const hudOrthoCoveragePillEl = document.getElementById('hudOrthoCoveragePill');
      if (hudOrthoCoveragePillEl) hudOrthoCoveragePillEl.textContent = oCovStr;

      const hudOrthoPaymentTermsEl = document.getElementById('hudOrthoPaymentTerms');
      if (hudOrthoPaymentTermsEl) hudOrthoPaymentTermsEl.textContent = 'Pay Terms: ' + oPayTermsStr;

      const meterOrthoBar = document.getElementById('meterOrthoBar');
      if (meterOrthoBar) {
        const numMax = parseFloat(String(oMaxStr).replace(/[^0-9.]/g, '')) || 0;
        const numRem = parseFloat(String(oRemStr).replace(/[^0-9.]/g, '')) || 0;
        if (numMax > 0) {
          const pct = Math.min(100, Math.max(5, Math.round((numRem / numMax) * 100)));
          meterOrthoBar.style.width = pct + '%';
        } else {
          meterOrthoBar.style.width = '100%';
        }
      }

      // Rules Row
      const rulesRow = document.getElementById('rulesRow');
      rulesRow.innerHTML = '';

      // Missing tooth clause
      const mtChip = document.createElement('div');
      mtChip.className = 'rule-chip';
      const hasMT = Boolean(details.missing_tooth_clause);
      mtChip.innerHTML = `
        <span class="rule-status-circle ${hasMT ? 'warn' : 'good'}"></span>
        <span><strong>Missing Tooth Clause:</strong> ${hasMT ? 'Applies (Yes)' : 'No (Waived)'}</span>
      `;
      rulesRow.appendChild(mtChip);

      // Waiting periods
      const wpChip = document.createElement('div');
      wpChip.className = 'rule-chip';
      const hasWP = Boolean(details.waiting_period);
      wpChip.innerHTML = `
        <span class="rule-status-circle ${hasWP ? 'warn' : 'good'}"></span>
        <span><strong>Waiting Period:</strong> ${hasWP ? 'Yes (' + (levels.waiting_period_details || 'Present') + ')' : 'No (Waived: ' + (levels.waiting_period_details || 'Basic 6mo Major 12') + ')'}</span>
      `;
      rulesRow.appendChild(wpChip);

      // Category Matrix Cards (Clinical Excel Categories - Ortho excluded)
      const categoryCardsGrid = document.getElementById('categoryCardsGrid');
      categoryCardsGrid.innerHTML = '';

      const hasMTC = Boolean(details.missing_tooth_clause);

      // Helper function to robustly determine coverage percentage and status
      function checkBenefitCoverage(rawVal, cdtObj) {
        let val = rawVal;
        if (cdtObj) {
          const cdtPct = (cdtObj.coverage_percentage || '').trim();
          if (cdtObj.is_eligible === false && (/^0%$/i.test(cdtPct) || /^nc$/i.test(cdtPct) || /not covered/i.test(cdtObj.notes || ''))) {
            return { isCovered: false, val: cdtPct || 'NC' };
          }
          if (cdtPct && !/^0%$/i.test(cdtPct) && !/^nc$/i.test(cdtPct) && !/not covered/i.test(cdtPct)) {
            val = cdtPct;
          }
        }

        if (!val || typeof val !== 'string') {
          return { isCovered: false, val: 'NC' };
        }

        const trimmed = val.trim();
        const lower = trimmed.toLowerCase();

        // Explicit non-covered patterns
        if (lower === 'nc' || lower === '0%' || lower === 'no' || lower === 'none' || lower === 'not covered' || lower === 'excluded') {
          return { isCovered: false, val: trimmed };
        }

        // Percentage check (e.g. 60%, 80%, 100%, 0%)
        const pctMatch = lower.match(/(\d+)%/);
        if (pctMatch) {
          const pctNum = parseInt(pctMatch[1], 10);
          return { isCovered: pctNum > 0, val: trimmed };
        }

        // Explicit NC or not covered phrase
        if (/\b(nc|not covered|excluded)\b/i.test(lower)) {
          return { isCovered: false, val: trimmed };
        }

        return { isCovered: true, val: trimmed };
      }

      const d6010Code = (data.procedure_codes || []).find(p => p.code && p.code.includes('D6010'));
      const d9944Code = (data.procedure_codes || []).find(p => p.code && (p.code.includes('D9944') || p.code.includes('D9940') || p.code.includes('D9951')));

      const implantBenefit = checkBenefitCoverage(levels.implants, d6010Code);
      const nightGuardBenefit = checkBenefitCoverage(levels.night_guard, d9944Code);
      const oralSurgeryBenefit = checkBenefitCoverage(levels.oral_surgery || levels.basic || '80%');
      const endoBenefit = checkBenefitCoverage(levels.endo || levels.basic || '80%');

      // Keep levels in sync for export & sheet views
      if (implantBenefit.val && implantBenefit.val !== 'NC') levels.implants = implantBenefit.val;
      if (nightGuardBenefit.val && nightGuardBenefit.val !== 'NC') levels.night_guard = nightGuardBenefit.val;

      const catMatrix = [
        {
          code: 'PREVENTATIVE',
          name: 'Preventive / Diag',
          val: levels.preventive || '100%',
          sub: 'Ded Applied: No',
          color: 'emerald'
        },
        {
          code: 'BASIC',
          name: 'Basic Restorative',
          val: levels.basic || '80%',
          sub: 'Ded Applied: Yes',
          color: 'cyan'
        },
        {
          code: 'MAJOR',
          name: 'Major Restorative',
          val: levels.major || '60%',
          sub: 'Ded Applied: Yes',
          color: 'indigo'
        },
        {
          code: 'ENDO',
          name: 'Endodontics',
          val: endoBenefit.val,
          sub: endoBenefit.isCovered ? 'Root Canals' : 'Not Covered (NC)',
          color: endoBenefit.isCovered ? 'cyan' : 'rose'
        },
        {
          code: 'ORAL SURGERY',
          name: 'Oral Surgery',
          val: oralSurgeryBenefit.val,
          sub: oralSurgeryBenefit.isCovered ? 'Extractions' : 'Not Covered (NC)',
          color: oralSurgeryBenefit.isCovered ? 'cyan' : 'rose'
        },
        {
          code: 'IMPLANTS D6010',
          name: 'Implant Placement',
          val: implantBenefit.val,
          sub: implantBenefit.isCovered ? 'Covered Benefit' : 'Not Covered (NC)',
          color: implantBenefit.isCovered ? 'cyan' : 'rose'
        },
        {
          code: 'NIGHT GUARD',
          name: 'D9944 Guard',
          val: nightGuardBenefit.val,
          sub: nightGuardBenefit.isCovered ? 'Covered Benefit' : 'Not Covered (NC)',
          color: nightGuardBenefit.isCovered ? 'cyan' : 'rose'
        },
        {
          code: 'MISSING TOOTH',
          name: 'Pre-existing Excl.',
          val: hasMTC ? 'Yes' : 'No',
          sub: hasMTC ? 'Clause Active' : 'Waived',
          color: hasMTC ? 'amber' : 'emerald'
        },
        {
          code: 'WAITING PERIOD',
          name: 'Waiting Period',
          val: hasWP ? 'Yes' : 'No',
          sub: hasWP ? (levels.waiting_period_details || 'Basic/Major') : 'No (Waived)',
          color: hasWP ? 'amber' : 'emerald'
        },
      ];

      catMatrix.forEach(item => {
        const cBox = document.createElement('div');
        cBox.className = `category-box cat-card-${item.color}`;
        cBox.style.cursor = 'pointer';
        cBox.title = `Click to edit ${item.code} value`;
        cBox.innerHTML = `
          <div class="category-code-tag">${item.code}</div>
          <div class="category-name-text">${item.name}</div>
          <div class="category-percentage-num">${item.val}</div>
          <div class="category-sub-note">${item.sub}</div>
        `;
        cBox.addEventListener('click', async () => {
          if (!currentAuditData) return;
          if (!currentAuditData.coverage_levels) currentAuditData.coverage_levels = {};
          if (!currentAuditData.insurance_details) currentAuditData.insurance_details = {};
          const cl = currentAuditData.coverage_levels;
          const idet = currentAuditData.insurance_details;

          if (item.code === 'MISSING TOOTH') {
            idet.missing_tooth_clause = !idet.missing_tooth_clause;
            displayToast(`Missing Tooth Clause set to: ${idet.missing_tooth_clause ? 'Yes' : 'No'}`);
          } else if (item.code === 'WAITING PERIOD') {
            const newWp = await openCustomPrompt(
              'Edit Waiting Period',
              'Enter Waiting Period details (or "No" to waive):',
              cl.waiting_period_details || (idet.waiting_period ? 'Yes' : 'No')
            );
            if (newWp === null) return;
            const trimmed = newWp.trim();
            if (/^(no|none|waived|0)$/i.test(trimmed)) {
              idet.waiting_period = false;
              cl.waiting_period_details = 'None';
            } else {
              idet.waiting_period = true;
              cl.waiting_period_details = trimmed;
            }
            displayToast('Updated Waiting Period!');
          } else {
            const newVal = await openCustomPrompt(
              `Edit ${item.code}`,
              `Enter coverage percentage or status for ${item.code} (${item.name}):`,
              item.val
            );
            if (newVal === null) return;
            const v = newVal.trim() || 'NC';
            if (item.code === 'PREVENTATIVE') cl.preventive = v;
            else if (item.code === 'BASIC') cl.basic = v;
            else if (item.code === 'MAJOR') cl.major = v;
            else if (item.code === 'ENDO') cl.endo = v;
            else if (item.code === 'ORAL SURGERY') cl.oral_surgery = v;
            else if (item.code === 'IMPLANTS D6010') {
              cl.implants = v;
              if (d6010Code) d6010Code.coverage_percentage = v;
            } else if (item.code === 'NIGHT GUARD') {
              cl.night_guard = v;
              if (d9944Code) d9944Code.coverage_percentage = v;
            }
            displayToast(`Updated ${item.code} to ${v}`);
          }
          renderReportDashboard(currentAuditData);
          persistActiveBreakdownToDb();
        });
        categoryCardsGrid.appendChild(cBox);
      });

      // Lock Insurance Company, Claims Address, Phone #, and Payor ID on Breakdown (Only switchable via Insurance Hub Directory)
      const lockedHubElements = [
        document.getElementById('carrierNameDisplay'),
        document.getElementById('heroCarrierSubDisplay'),
        document.getElementById('heroClaimsAddressDisplay'),
        document.getElementById('heroPayorIdDisplay'),
        document.getElementById('heroClaimsAddressCell'),
        document.getElementById('switchWiredHubBtn'),
      ];
      lockedHubElements.forEach(el => {
        if (!el) return;
        el.style.cursor = 'pointer';
        el.onclick = (ev) => {
          ev.stopPropagation();
          openInsuranceDirectory();
          displayToast('🔒 Insurance Company, Address & Payor ID are locked to Clinic Directory. Click "Apply to Policy" on a Hub!');
        };
      });

      // Make non-locked Policy Hero Card fields click-to-edit
      const heroEditBindings = [
        { id: 'heroPatientNameDisplay', label: 'Patient Name', get: () => details.patient_name || '', set: (v) => { details.patient_name = v; } },
        { id: 'heroPatientDobDisplay', label: 'Patient DOB (MM/DD/YYYY)', get: () => details.dob || '', set: (v) => { details.dob = v; } },
        { id: 'heroGroupNameDisplay', label: 'Employer / Group Name', get: () => details.group_name || '', set: (v) => { details.group_name = v; } },
        { id: 'heroGroupNumberDisplay', label: 'Group Number', get: () => details.group_number || '', set: (v) => { details.group_number = v; } },
        { id: 'heroEffectiveDateDisplay', label: 'Effective Date', get: () => details.effective_date || '', set: (v) => { details.effective_date = v; } },
        { id: 'heroTermedDateDisplay', label: 'Termed Date (or "Active (None)")', get: () => details.termed_date || 'Active (None)', set: (v) => { details.termed_date = v; } },
        { id: 'heroPlanBenefitsDisplay', label: 'Plan Benefits Period (e.g. Calendar Year)', get: () => details.plan_benefits || 'Calendar Year', set: (v) => { details.plan_benefits = v; } },
        { id: 'heroFeeScheduleDisplay', label: 'Fee Schedule / Tier', get: () => details.fee_schedule || '', set: (v) => { details.fee_schedule = v; } },
        { id: 'heroPaymentToDisplay', label: 'Insurance Payment Goes To (Patient / Office)', get: () => details.payment_recipient || 'Office', set: (v) => { details.payment_recipient = v; } },
        { id: 'hudAnnualMax', label: 'Annual Maximum ($)', get: () => details.annual_maximum ?? '', set: (v) => { const n = parseFloat(String(v).replace(/[^0-9.]/g, '')); details.annual_maximum = isNaN(n) ? null : n; } },
        { id: 'hudRemainingMax', label: 'Remaining Annual Maximum ($)', get: () => details.remaining_maximum ?? '', set: (v) => { const n = parseFloat(String(v).replace(/[^0-9.]/g, '')); details.remaining_maximum = isNaN(n) ? null : n; } },
        { id: 'hudDeductible', label: 'Individual Deductible ($)', get: () => details.deductible_individual ?? '', set: (v) => { const n = parseFloat(String(v).replace(/[^0-9.]/g, '')); details.deductible_individual = isNaN(n) ? null : n; } },
        { id: 'hudRemainingDed', label: 'Remaining Deductible ($)', get: () => details.deductible_remaining ?? '', set: (v) => { const n = parseFloat(String(v).replace(/[^0-9.]/g, '')); details.deductible_remaining = isNaN(n) ? null : n; } },
        { id: 'hudDedApplies', label: 'Deductible Applies To', get: () => details.deductible_applies_to || '', set: (v) => { details.deductible_applies_to = v; } },
        { id: 'hudOrthoMax', label: 'Ortho Maximum (e.g. $1,000)', get: () => levels.ortho_max || '$1,000', set: (v) => { levels.ortho_max = v; } },
        { id: 'hudOrthoRem', label: 'Remaining Ortho (e.g. $999)', get: () => levels.ortho_remaining || '$999', set: (v) => { levels.ortho_remaining = v; } },
        { id: 'hudOrthoAgeLimit', label: 'Ortho Age Limit', get: () => levels.ortho_age_limit || '26', set: (v) => { levels.ortho_age_limit = v; } },
        { id: 'hudOrthoCoveragePill', label: 'Ortho Coverage %', get: () => levels.ortho || '50%', set: (v) => { levels.ortho = v; } },
        { id: 'hudOrthoPaymentTerms', label: 'Ortho Payment Terms (Monthly / Quarterly / Yearly / Lump Sum / N/A)', get: () => levels.ortho_payment_terms || 'Monthly', set: (v) => { levels.ortho_payment_terms = v; } },
      ];

      heroEditBindings.forEach(b => {
        const el = document.getElementById(b.id);
        if (!el) return;
        el.style.cursor = 'pointer';
        el.title = `Click to edit ${b.label}`;
        el.onclick = async (ev) => {
          ev.stopPropagation();
          const nextVal = await openCustomPrompt(`Edit ${b.label}`, `Update ${b.label}:`, b.get());
          if (nextVal === null) return;
          b.set(nextVal.trim());
          renderReportDashboard(currentAuditData);
          persistActiveBreakdownToDb();
          displayToast(`Updated ${b.label}!`);
        };
      });

      // Render Clean Bordered Excel Breakdown Sheet (Option 4)
      renderExcelBreakdownSheet(data);

      // Populate CDT Codes Table
      renderCdtTable();

      // Hide Upload Section so ONLY IV Information is visible
      const heroSec = document.querySelector('.hero-section');
      if (heroSec) heroSec.style.display = 'none';
      const formPan = document.getElementById('formPanel');
      if (formPan) formPan.style.display = 'none';

      // Show Report Dashboard
      reportDashboard.classList.add('active');
      reportDashboard.style.display = 'block';
    }

    // Render CDT Table
    function renderCdtTable() {
      const allCodes = currentAuditData?.procedure_codes || [];
      cdtTableBody.innerHTML = '';

      const query = currentSearch.trim().toLowerCase();

      const filtered = allCodes.filter(item => {
        const textMatch = 
          (item.code || '').toLowerCase().includes(query) ||
          (item.description || '').toLowerCase().includes(query) ||
          (item.notes || '').toLowerCase().includes(query) ||
          (item.downgrade_rule || '').toLowerCase().includes(query);

        if (!textMatch) return false;

        const cat = categorizeProcedureCode(item);

        if (currentFilter === 'preventative') {
          return cat === 'preventative';
        } else if (currentFilter === 'periodontal') {
          return cat === 'periodontal';
        } else if (currentFilter === 'restorative') {
          return cat === 'restorative';
        } else if (currentFilter === 'major') {
          return cat === 'major';
        } else if (currentFilter === 'ortho') {
          return cat === 'ortho';
        } else if (currentFilter === 'eligible') {
          return item.is_eligible === true;
        } else if (currentFilter === 'downgrades') {
          return item.downgrade_rule && item.downgrade_rule.toLowerCase() !== 'none' && item.downgrade_rule !== '';
        }

        return true;
      });

      // Strictly sort by Clinical 1-to-21 sequence
      filtered.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));

      codesCountPill.textContent = `${filtered.length} of ${allCodes.length} codes`;

      if (filtered.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="10" style="text-align: center; color: var(--text-muted); padding: 3rem;">No procedure codes found matching current filter/query.</td>`;
        cdtTableBody.appendChild(tr);
        return;
      }

      // Group into the 4 clinical categories requested by user:
      // 1. Preventative, 2. Periodontal, 3. Restorative (2391), 4. Major
      const categoriesDef = [
        { key: 'preventative', title: 'PREVENTATIVE', badgeStyle: 'background: #fce7f3; color: #9d174d; border: 1px solid #fbcfe8;', desc: 'D4346, Prophy, Bitewings, FMX/Pano, PA\'s, Palliative, Exams, Sealants, Fluoride' },
        { key: 'periodontal', title: 'PERIODONTAL', badgeStyle: 'background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;', desc: 'D4341 (SRP), D4910 (Perio Maintenance)' },
        { key: 'restorative', title: 'RESTORATIVE (2391)', badgeStyle: 'background: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff;', desc: 'D2391 (Posterior Composite Filling)' },
        { key: 'major', title: 'MAJOR', badgeStyle: 'background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;', desc: 'D2740 (Crown), D2920 (Recement), D7140/D7210 (Extractions), D9222/D9223 (Sedation), D9944 (Night Guard)' },
      ];

      categoriesDef.forEach(catDef => {
        const catCodes = filtered.filter(item => categorizeProcedureCode(item) === catDef.key);
        if (catCodes.length === 0) return;

        // Category header row
        const catRow = document.createElement('tr');
        catRow.className = 'category-header-row';
        catRow.innerHTML = `
          <td colspan="10" style="background: rgba(15, 23, 42, 0.95); padding: 0.65rem 0.85rem; border-top: 2px solid rgba(56, 189, 248, 0.25); border-bottom: 1px solid rgba(56, 189, 248, 0.2);">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <span style="${catDef.badgeStyle} font-weight: 800; font-size: 0.78rem; padding: 2px 9px; border-radius: 4px; letter-spacing: 0.04em;">${catDef.title}</span>
                <span style="font-size: 0.78rem; color: var(--text-secondary);">${catDef.desc}</span>
              </div>
              <span style="font-size: 0.74rem; color: var(--cyan-bright); font-family: var(--font-mono); font-weight: 700;">${catCodes.length} procedure${catCodes.length > 1 ? 's' : ''}</span>
            </div>
          </td>
        `;
        cdtTableBody.appendChild(catRow);

        catCodes.forEach(p => {
          const tr = document.createElement('tr');

          // Status badge
          const statusBadge = p.is_eligible
            ? `<span class="badge-status-eligible"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>Eligible</span>`
            : `<span class="badge-status-ineligible"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>Ineligible</span>`;

          // Downgrade pill
          let downgradeCell = `<span style="color: var(--text-muted); font-size: 0.8rem;">None</span>`;
          if (p.downgrade_rule && p.downgrade_rule.toLowerCase() !== 'none') {
            downgradeCell = `<span class="downgrade-flag"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 2 22 22 22 12 2"></polygon><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>${escapeHtml(p.downgrade_rule)}</span>`;
          }

          // Ded Applies
          const dedCell = p.deductible_applied ? `<span class="tag-ded-yes">Applies</span>` : `<span class="tag-ded-no">Waived</span>`;

          const editIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.45; margin-left:3px; flex-shrink:0;"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;

          const lockedMeaning = getCanonicalCdtMeaning(p.code, p.description);
          p.description = lockedMeaning;

          tr.innerHTML = `
            <td><span class="cdt-badge" title="Standard ADA CDT Code (Locked)">${escapeHtml(p.code || 'CDT')}</span></td>
            <td class="desc-text"><span class="locked-cdt-meaning" title="Standard CDT Meaning (Built-in Website Memory • Non-Editable)" style="color: #e2e8f0; font-weight: 600; cursor: default;">${escapeHtml(lockedMeaning)}</span></td>
            <td style="text-align: center;"><span class="editable-cell" data-code="${escapeHtml(p.code)}" data-field="coverage_percentage" title="Click to edit Benefit %"><span class="pct-badge-num" style="color: #38bdf8;">${escapeHtml(p.coverage_percentage || '0%')}</span>${editIcon}</span></td>
            <td style="text-align: center;"><span class="clickable-toggle-pill" data-code="${escapeHtml(p.code)}" data-field="deductible_applied" title="Click to toggle Deductible">${dedCell}</span></td>
            <td><span class="editable-cell" data-code="${escapeHtml(p.code)}" data-field="frequency_limitation" title="Click to edit Frequency">${escapeHtml(p.frequency_limitation || '-')}${editIcon}</span></td>
            <td style="text-align: center;"><span class="editable-cell" data-code="${escapeHtml(p.code)}" data-field="age_limit" title="Click to edit Age Limit">${escapeHtml(p.age_limit || 'None')}${editIcon}</span></td>
            <td style="text-align: center;"><span class="clickable-toggle-pill" data-code="${escapeHtml(p.code)}" data-field="is_eligible" title="Click to toggle Eligibility">${statusBadge}</span></td>
            <td><span class="editable-cell history-text" data-code="${escapeHtml(p.code)}" data-field="history_dates" title="Click to edit History on File">${escapeHtml(p.history_dates || 'None')}${editIcon}</span></td>
            <td><span class="editable-cell" data-code="${escapeHtml(p.code)}" data-field="downgrade_rule" title="Click to edit Downgrade Clause">${downgradeCell}${editIcon}</span></td>
            <td class="notes-snippet"><span class="editable-cell" data-code="${escapeHtml(p.code)}" data-field="notes" title="Click to edit Notes">${escapeHtml(p.notes || '-')}${editIcon}</span></td>
          `;

          cdtTableBody.appendChild(tr);
        });
      });
    }

    async function persistActiveBreakdownToDb() {
      if (!currentAuditData || currentAuditData.is_sample || !currentAuditData.verification_id) return;
      try {
        const res = await fetch(`/api/verifications/${currentAuditData.verification_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ breakdown: currentAuditData }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.payers) && data.payers.length > 0) {
            activeClinicPayers = data.payers.map((item, idx) => normalizePayerItem(item, idx));
            try {
              localStorage.setItem(PAYER_DIRECTORY_STORAGE_KEY, JSON.stringify(activeClinicPayers));
            } catch (e) {}
          }
        }
        await syncHistoryFromBackend();
      } catch (e) {
        console.warn('Could not persist breakdown edit:', e);
      }
    }

    // CDT Table Inline Editing & Toggles Event Delegation
    cdtTableBody.addEventListener('click', (e) => {
      // 1. Clickable toggle pills (Deductible & Eligibility Status)
      const toggleEl = e.target.closest('.clickable-toggle-pill');
      if (toggleEl) {
        const code = toggleEl.dataset.code;
        const field = toggleEl.dataset.field;
        if (!currentAuditData || !Array.isArray(currentAuditData.procedure_codes)) return;
        const p = currentAuditData.procedure_codes.find(item => item.code === code);
        if (!p) return;

        if (field === 'deductible_applied') {
          p.deductible_applied = !p.deductible_applied;
          displayToast(`${code} Deductible: ${p.deductible_applied ? 'Applies' : 'Waived'}`);
        } else if (field === 'is_eligible') {
          p.is_eligible = !p.is_eligible;
          displayToast(`${code} Eligibility: ${p.is_eligible ? 'Eligible' : 'Ineligible'}`);
        }
        renderCdtTable();
        renderExcelBreakdownSheet(currentAuditData);
        if (pmsModal && pmsModal.classList.contains('active')) buildPmsNote();
        persistActiveBreakdownToDb();
        return;
      }

      // 2. Editable text cells
      const editCell = e.target.closest('.editable-cell');
      if (editCell) {
        if (editCell.querySelector('.editable-cell-input')) return; // already active

        const code = editCell.dataset.code;
        const field = editCell.dataset.field;
        if (!currentAuditData || !Array.isArray(currentAuditData.procedure_codes)) return;
        const p = currentAuditData.procedure_codes.find(item => item.code === code);
        if (!p) return;

        const currentVal = p[field] || '';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'editable-cell-input';
        input.value = (currentVal === 'None' || currentVal === '-') ? '' : currentVal;
        input.placeholder = currentVal || 'Enter value...';

        let finished = false;
        const finishEdit = (save) => {
          if (finished) return;
          finished = true;
          if (save) {
            let val = input.value.trim();
            if (field === 'downgrade_rule' && !val) val = 'None';
            if (field === 'age_limit' && !val) val = 'None';
            if (field === 'history_dates' && !val) val = 'None';
            if (field === 'frequency_limitation') {
              val = val ? formatFrequencyNotation(val) : '-';
            }
            if (field === 'coverage_percentage' && !val) val = '0%';
            p[field] = val;
            displayToast(`Updated ${code} ${field.replace('_', ' ')}`);
            persistActiveBreakdownToDb();
          }
          renderCdtTable();
          renderExcelBreakdownSheet(currentAuditData);
          if (pmsModal && pmsModal.classList.contains('active')) buildPmsNote();
        };

        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            input.blur();
          } else if (ev.key === 'Escape') {
            ev.preventDefault();
            finishEdit(false);
          }
        });

        input.addEventListener('blur', () => {
          finishEdit(true);
        });

        editCell.innerHTML = '';
        editCell.appendChild(input);
        input.focus();
        input.select();
      }
    });

    // Search and filter listeners
    cdtSearchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      renderCdtTable();
    });

    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        renderCdtTable();
      });
    });

    // Reset button (resets state cleanly without reload)
    newVerificationBtn.addEventListener('click', () => {
      resetVerificationState();
    });

    const bottomNewBreakdownBtn = document.getElementById('bottomNewBreakdownBtn');
    if (bottomNewBreakdownBtn) {
      bottomNewBreakdownBtn.addEventListener('click', () => {
        resetVerificationState();
      });
    }

    // Format PMS Text
    function buildPmsNote() {
      if (!currentAuditData) return '';
      const d = currentAuditData.insurance_details || {};
      const c = currentAuditData.coverage_levels || {};
      const meta = currentAuditData.audit_meta || {};
      const codes = (currentAuditData.procedure_codes || []).slice();

      // Strictly sort by active clinic's CDT sequence
      codes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));

      const today = new Date().toLocaleDateString('en-US');
      const verifiedBy = meta.verified_by_name || currentUser?.full_name || 'Clinic Staff';
      const verifiedAt = meta.verified_at || today;
      const readinessStatus = meta.readiness_status || 'Complete / Ready for Appointment';

      let txt = `==========================================================\n`;
      txt += `DENTAL INSURANCE VERIFICATION AUDIT [${today}]\n`;
      txt += `VERIFIED BY:          ${verifiedBy} (${verifiedAt})\n`;
      txt += `APPOINTMENT STATUS:   ${readinessStatus}\n`;
      txt += `==========================================================\n`;
      if (d.patient_name && d.patient_name.trim() !== '' && d.patient_name.toLowerCase() !== 'n/a') {
        txt += `PATIENT NAME:         ${d.patient_name.trim()}\n`;
      }
      if (d.dob && d.dob.trim() !== '' && d.dob.toLowerCase() !== 'n/a') {
        const age = calculateAge(d.dob);
        txt += `PATIENT DOB:          ${d.dob.trim()}${age !== null ? ` (Age: ${age})` : ''}\n`;
      }
      const grpNote = (d.group_name && d.group_name.trim() !== '' && !/^(none|n\/a|na|-)$/i.test(d.group_name.trim())) ? d.group_name.trim() : '';
      const plnNote = (d.plan_name && d.plan_name.trim() !== '' && !/^(none|n\/a|na|-)$/i.test(d.plan_name.trim())) ? d.plan_name.trim() : '';
      let grpPlanNote = 'N/A';
      if (grpNote && plnNote && grpNote.toLowerCase() !== plnNote.toLowerCase()) {
        grpPlanNote = `${grpNote} • ${plnNote}`;
      } else if (grpNote) {
        grpPlanNote = grpNote;
      } else if (plnNote) {
        grpPlanNote = plnNote;
      }

      txt += `EMPLOYER / GROUP:     ${grpPlanNote}\n`;
      txt += `GROUP NUMBER:         ${d.group_number || 'N/A'}\n`;
      txt += `INSURANCE COMPANY:    ${d.carrier || 'Dental Insurance'}\n`;
      if (d.insurance_address && !/^(none|n\/a|na|-)$/i.test(d.insurance_address.trim())) {
        txt += `INS CLAIMS ADDRESS:   ${d.insurance_address.trim()}\n`;
      }
      if (d.insurance_phone && !/^(none|n\/a|na|-)$/i.test(d.insurance_phone.trim())) {
        txt += `INS PHONE NUMBER:     ${d.insurance_phone.trim()}\n`;
      }
      if (d.payor_id && !/^(none|n\/a|na|-)$/i.test(d.payor_id.trim())) {
        txt += `ELECTRONIC PAYOR ID:  ${d.payor_id.trim()}\n`;
      }
      txt += `NETWORK STATUS:       ${d.network_status || 'In Network'}\n`;
      txt += `POLICY STATUS:        ${d.policy_status || 'Active'}\n`;
      txt += `EFFECTIVE DATE:       ${d.effective_date || '01/01/2026'}\n`;
      txt += `TERMED DATE:          ${d.termed_date || 'Active (None)'}\n`;
      txt += `PLAN BENEFITS:        ${d.plan_benefits || 'Calendar Year'}\n`;
      txt += `FEE SCHEDULE:         ${d.fee_schedule || 'Delta Dental PPO'}\n`;
      txt += `PAYMENT GOES TO:      ${d.payment_recipient || 'Patient or Office'}\n`;
      txt += `ANNUAL MAXIMUM:       ${fmtMoney(d.annual_maximum)} | REMAINING: ${fmtMoney(d.remaining_maximum)}\n`;
      txt += `INDIVIDUAL DED:       ${fmtMoney(d.deductible_individual)} | REMAINING: ${fmtMoney(d.deductible_remaining)}\n`;
      txt += `DEDUCTIBLE APPLIES:   ${d.deductible_applies_to || 'Basic & Major only, Waived on Preventive'}\n`;
      txt += `ORTHO MAX:            ${c.ortho_max || '$1,000'} | REMAINING ORTHO: ${c.ortho_remaining || c.ortho_max || '$1,000'}\n`;
      txt += `ORTHO AGE LIMIT:      ${c.ortho_age_limit || '14 Maximum'} | ORTHO COVERAGE: ${c.ortho || '50%'}\n`;
      txt += `ORTHO PAYMENT TERMS:  ${c.ortho_payment_terms || 'Monthly'}\n`;
      txt += `PREVENTIVE TO MAX:    ${d.preventive_applies_to_max ? 'YES (Counts toward max)' : 'NO (Waived from max)'}\n`;
      txt += `MISSING TOOTH CLAUSE: ${d.missing_tooth_clause ? 'YES' : 'NO'}\n`;
      txt += `WAITING PERIODS:      ${d.waiting_period ? 'YES' : 'NO'} (${c.waiting_period_details || 'Basic 6mo Major 12'})\n`;
      txt += `----------------------------------------------------------\n`;
      txt += `CATEGORY BREAKDOWN:\n`;
      txt += ` • Preventative:      ${c.preventive || '100%'} (Ded Applied: No)\n`;
      txt += ` • Basic:             ${c.basic || '80%'} (Ded Applied: Yes)\n`;
      txt += ` • Major:             ${c.major || '60%'} (Ded Applied: Yes)\n`;
      txt += ` • ENDO:              ${c.endo || '80%'}\n`;
      txt += ` • ORAL SURGERY:      ${c.oral_surgery || '80%'}\n`;
      txt += ` • IMPLANTS D6010:    ${c.implants || 'NC'}\n`;
      txt += ` • NIGHT GUARD D9944: ${c.night_guard || 'NC'}\n`;
      txt += ` • Orthodontics:      ${c.ortho || '50%'} (Max: ${c.ortho_max || '$1,000'}, Remaining: ${c.ortho_remaining || c.ortho_max || '$1,000'}, Age Limit: ${c.ortho_age_limit || '14 Maximum'}, Pay Terms: ${c.ortho_payment_terms || 'Monthly'})\n`;
      txt += `----------------------------------------------------------\n`;
      txt += `AUDITED CDT PROCEDURE CODES (SEPARATED BY CATEGORIES):\n`;

      const categoriesDef = [
        { key: 'preventative', title: '1. PREVENTATIVE' },
        { key: 'periodontal', title: '2. PERIODONTAL' },
        { key: 'restorative', title: '3. RESTORATIVE (D2391)' },
        { key: 'major', title: '4. MAJOR' },
      ];

      categoriesDef.forEach(catDef => {
        const catCodes = codes.filter(cd => categorizeProcedureCode(cd) === catDef.key);
        if (catCodes.length === 0) return;
        txt += `\n[${catDef.title}]\n`;
        catCodes.forEach(cd => {
          txt += `• ${cd.code} - ${cd.description}\n`;
          txt += `  Coverage: ${cd.coverage_percentage} | Ded: ${cd.deductible_applied ? 'Applies' : 'Waived'} | Freq: ${cd.frequency_limitation} | Elig: ${cd.is_eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}\n`;
          if (cd.history_dates && cd.history_dates.toLowerCase() !== 'none') {
            txt += `  History on File: ${cd.history_dates}\n`;
          }
          if (cd.downgrade_rule && cd.downgrade_rule.toLowerCase() !== 'none') {
            txt += `  Downgrade: ${cd.downgrade_rule}\n`;
          }
          if (cd.notes && cd.notes.trim() !== '') {
            txt += `  Note: ${cd.notes}\n`;
          }
        });
      });

      txt += `\n==========================================================\n`;
      txt += `Verified via DentVerify AI (dentverify.com)\n`;

      pmsNoteContent.value = txt;
      return txt;
    }

    // Modal Events
    openPmsModalBtn.addEventListener('click', () => {
      buildPmsNote();
      pmsModal.classList.add('active');
    });

    closePmsModalBtn.addEventListener('click', () => {
      pmsModal.classList.remove('active');
    });

    pmsModal.addEventListener('click', (e) => {
      if (e.target === pmsModal) {
        pmsModal.classList.remove('active');
      }
    });

    copyPmsNoteBtn.addEventListener('click', () => {
      pmsNoteContent.select();
      navigator.clipboard.writeText(pmsNoteContent.value).then(() => {
        displayToast('PMS Note copied to clipboard!');
      }).catch(() => {
        document.execCommand('copy');
        displayToast('PMS Note copied to clipboard!');
      });
    });

    // ==========================================
    // EXCEL BREAKDOWN SHEET & DIRECT 1-CLICK VECTOR PDF DOWNLOAD
    // ==========================================
    const openExcelModalBtn = document.getElementById('openExcelModalBtn');
    const excelModal = document.getElementById('excelModal');
    const closeExcelModalBtn = document.getElementById('closeExcelModalBtn');
    const printExcelModalBtn = document.getElementById('printExcelModalBtn');
    const copyExcelTableBtn = document.getElementById('copyExcelTableBtn');
    const directDownloadPdfBtn = document.getElementById('directDownloadPdfBtn');
    const downloadCleanPdfModalBtn = document.getElementById('downloadCleanPdfModalBtn');

    openExcelModalBtn?.addEventListener('click', () => {
      if (currentAuditData) {
        renderExcelBreakdownSheet(currentAuditData);
      }
      excelModal.classList.add('active');
    });

    closeExcelModalBtn?.addEventListener('click', () => {
      excelModal.classList.remove('active');
    });

    excelModal?.addEventListener('click', (e) => {
      if (e.target === excelModal) {
        excelModal.classList.remove('active');
      }
    });

    printExcelModalBtn?.addEventListener('click', () => {
      if (currentAuditData) {
        renderExcelBreakdownSheet(currentAuditData);
      }
      window.print();
    });

    copyExcelTableBtn?.addEventListener('click', () => {
      const pmsText = buildPmsNote();
      navigator.clipboard.writeText(pmsText).then(() => {
        displayToast('Excel breakdown sheet text copied to clipboard!');
      }).catch(() => {
        document.execCommand('copy');
        displayToast('Excel breakdown sheet text copied to clipboard!');
      });
    });

    // Format filename as LastName_FirstName_Carrier_IV.pdf
    function buildCleanPdfFilename(data) {
      const d = (data && data.insurance_details) ? data.insurance_details : {};
      const rawName = (d.patient_name && !/^(none|n\/a|na|-)$/i.test(d.patient_name.trim())) ? d.patient_name.trim() : 'Patient_Breakdown';
      let lastFirst = 'Patient';
      if (rawName.includes(',')) {
        const parts = rawName.split(',').map(s => s.trim()).filter(Boolean);
        lastFirst = parts.join('_');
      } else {
        const words = rawName.split(/\s+/).filter(Boolean);
        if (words.length >= 2) {
          const last = words[words.length - 1];
          const first = words.slice(0, words.length - 1).join('');
          lastFirst = `${last}_${first}`;
        } else if (words.length === 1) {
          lastFirst = words[0];
        }
      }
      const rawCarrier = (d.carrier || 'Carrier').replace(/\(.*?\)/g, '').trim();
      const safePart = (s) => String(s || '').replace(/[^a-zA-Z0-9]+/g, '').slice(0, 28) || 'Carrier';
      const safeName = lastFirst.split('_').map(p => p.replace(/[^a-zA-Z0-9]+/g, '')).filter(Boolean).join('_') || 'Patient';
      return `${safeName}_${safePart(rawCarrier)}_IV.pdf`;
    }

    // Pure-JS Single-Page Vector PDF 1.4 Generator (Zero External Dependencies, CSP-Safe)
    function generateCleanBreakdownPdfBytes(data) {
      const d = (data && data.insurance_details) ? data.insurance_details : {};
      const c = (data && data.coverage_levels) ? data.coverage_levels : {};
      const meta = (data && data.audit_meta) ? data.audit_meta : {};
      const allCodes = ((data && data.procedure_codes) ? data.procedure_codes : []).slice();
      allCodes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));

      const pdfEsc = (str) => String(str ?? '')
        .replace(/[^\x20-\x7E]/g, ' ')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');

      const trunc = (str, maxLen) => {
        const s = String(str ?? '').replace(/\s+/g, ' ').trim();
        return s.length > maxLen ? s.slice(0, maxLen - 2) + '..' : s;
      };

      const ops = [];
      const pageW = 612;
      const pageH = 792;
      const marginX = 20;
      const contentW = pageW - marginX * 2; // 572

      const drawRect = (x, topY, w, h, fillRgb, strokeRgb, lineW = 0.6) => {
        const pdfY = pageH - topY - h;
        ops.push(`${lineW} w`);
        if (fillRgb && strokeRgb) {
          ops.push(`${fillRgb[0]} ${fillRgb[1]} ${fillRgb[2]} rg ${strokeRgb[0]} ${strokeRgb[1]} ${strokeRgb[2]} RG ${x.toFixed(1)} ${pdfY.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} B`);
        } else if (fillRgb) {
          ops.push(`${fillRgb[0]} ${fillRgb[1]} ${fillRgb[2]} rg ${x.toFixed(1)} ${pdfY.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} f`);
        } else if (strokeRgb) {
          ops.push(`${strokeRgb[0]} ${strokeRgb[1]} ${strokeRgb[2]} RG ${x.toFixed(1)} ${pdfY.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} S`);
        }
      };

      const drawLine = (x1, topY1, x2, topY2, strokeRgb = [0.78, 0.82, 0.87], lineW = 0.5) => {
        const y1 = pageH - topY1;
        const y2 = pageH - topY2;
        ops.push(`${lineW} w ${strokeRgb[0]} ${strokeRgb[1]} ${strokeRgb[2]} RG ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`);
      };

      const drawText = (text, x, topY, size = 7.5, bold = false, rgb = [0.06, 0.09, 0.16]) => {
        const pdfY = pageH - topY - size * 0.82;
        const fontName = bold ? '/F2' : '/F1';
        ops.push(`BT ${fontName} ${size.toFixed(1)} Tf ${rgb[0]} ${rgb[1]} ${rgb[2]} rg ${x.toFixed(1)} ${pdfY.toFixed(1)} Td (${pdfEsc(text)}) Tj ET`);
      };

      let curY = 18;

      // 1. Top Title Banner
      drawRect(marginX, curY, contentW, 22, [0.06, 0.09, 0.16], [0.06, 0.09, 0.16]);
      drawText('DENTAL INSURANCE BENEFIT BREAKDOWN FORM', marginX + 8, curY + 4, 9.5, true, [1, 1, 1]);
      const verifiedBy = meta.verified_by_name || currentUser?.full_name || 'Clinic Staff';
      const verifiedAt = meta.verified_at || new Date().toLocaleDateString('en-US');
      const readiness = meta.readiness_status || 'Complete / Ready for Appointment';
      drawText(`Verified by: ${trunc(verifiedBy, 22)} (${trunc(verifiedAt, 18)})  |  Status: ${trunc(readiness, 32)}`, marginX + 245, curY + 5.5, 6.8, true, [0.22, 0.74, 0.97]);
      curY += 24;

      // 2. Policy Header Table (12 rows x 4 columns)
      const pName = (d.patient_name && !/^(none|n\/a|na|-)$/i.test(d.patient_name.trim())) ? d.patient_name.trim() : 'N/A';
      const pDob = (d.dob && !/^(none|n\/a|na|-)$/i.test(d.dob.trim())) ? d.dob.trim() : '';
      const pAge = pDob ? calculateAge(pDob) : null;
      const dobDisplay = pDob ? `${pDob}${pAge !== null ? ` (Age: ${pAge})` : ''}` : 'N/A';
      const grp = (d.group_name && !/^(none|n\/a|na|-)$/i.test(d.group_name.trim())) ? d.group_name.trim() : '';
      const pln = (d.plan_name && !/^(none|n\/a|na|-)$/i.test(d.plan_name.trim())) ? d.plan_name.trim() : '';
      const grpPlan = (grp && pln && grp.toLowerCase() !== pln.toLowerCase()) ? `${grp} - ${pln}` : (grp || pln || 'N/A');
      const grpNum = d.group_number || 'N/A';
      const carrier = d.carrier || 'Dental Insurance';
      const insPhone = d.insurance_phone || 'N/A';
      const insAddr = d.insurance_address || 'N/A';
      const payorId = d.payor_id || 'N/A';
      const netStatus = d.network_status || 'In-Network';
      const polStatus = d.policy_status || 'Active';
      const effDate = d.effective_date || '01/01/2026';
      const termDate = d.termed_date || 'Active (None)';
      const planBen = d.plan_benefits || 'Calendar Year';
      const feeSched = d.fee_schedule || (carrier + ' PPO');
      const payTo = d.payment_recipient || 'Patient or Office';
      const prevMax = d.preventive_applies_to_max ? 'Yes' : 'No';
      const annMax = fmtMoney(d.annual_maximum);
      const remMax = fmtMoney(d.remaining_maximum);
      const indDed = fmtMoney(d.deductible_individual);
      const remDed = fmtMoney(d.deductible_remaining);
      const dedScope = d.deductible_applies_to || 'Basic & Major Services Only (Waived on Preventive)';
      const oMax = c.ortho_max || '$1,000';
      const oRem = c.ortho_remaining || c.ortho_max || '$1,000';
      const oAge = c.ortho_age_limit || '14 Maximum';
      const oCov = c.ortho || '50%';
      const oTerms = c.ortho_payment_terms || 'Monthly';

      const headerRows = [
        ['Subscriber Name:', trunc(pName, 36), 'Subscriber DOB:', trunc(dobDisplay, 30)],
        ['Employer / Group:', trunc(grpPlan, 36), 'Group #:', trunc(grpNum, 30)],
        ['Ins Company (Locked):', trunc(carrier, 36), 'Ins Ph #:', trunc(insPhone, 30)],
        ['Ins Claims Address:', trunc(insAddr, 42), 'Electronic Payor ID:', trunc(payorId, 28)],
        ['Network Participation:', trunc(netStatus, 32), 'Policy Status:', trunc(polStatus, 28)],
        ['Effective Date:', trunc(effDate, 32), 'Termed Date:', trunc(termDate, 28)],
        ['Plan Benefits:', trunc(planBen, 32), 'Fee Schedule / Tier:', trunc(feeSched, 32)],
        ['Yearly Maximum:', trunc(annMax, 28), 'Remaining Benefits:', trunc(remMax, 28)],
        ['Payment Goes To:', trunc(payTo, 32), 'Prev Counts to Max?:', trunc(prevMax, 28)],
        ['Individual Deductible:', trunc(indDed, 28), 'Deductible Remaining:', trunc(remDed, 28)],
        ['Deductible Scope:', trunc(dedScope, 42), 'Ortho Payment Terms:', trunc(oTerms, 28)],
        ['Ortho Max / Rem:', `${trunc(oMax, 14)} / Rem: ${trunc(oRem, 14)}`, 'Ortho Coverage / Age:', `${trunc(oCov, 12)} (Age Limit: ${trunc(oAge, 14)})`],
      ];

      const rowH = 11.5;
      const colW = [105, 181, 105, 181];
      headerRows.forEach((r, idx) => {
        const isOrthoRow = idx === 11;
        const bg = isOrthoRow ? [0.94, 0.99, 0.96] : (idx % 2 === 0 ? [0.98, 0.99, 1.0] : [1, 1, 1]);
        drawRect(marginX, curY, contentW, rowH, bg, [0.78, 0.82, 0.87], 0.4);
        let xOff = marginX;
        drawRect(xOff, curY, colW[0], rowH, [0.93, 0.95, 0.98], [0.78, 0.82, 0.87], 0.4);
        drawText(r[0], xOff + 4, curY + 2.2, 6.8, true, [0.15, 0.2, 0.3]);
        xOff += colW[0];
        drawText(r[1], xOff + 4, curY + 2.2, 6.9, idx === 0 || idx === 2, idx === 0 ? [0.01, 0.45, 0.72] : [0.06, 0.09, 0.16]);
        xOff += colW[1];
        drawRect(xOff, curY, colW[2], rowH, [0.93, 0.95, 0.98], [0.78, 0.82, 0.87], 0.4);
        drawText(r[2], xOff + 4, curY + 2.2, 6.8, true, [0.15, 0.2, 0.3]);
        xOff += colW[2];
        drawText(r[3], xOff + 4, curY + 2.2, 6.9, idx === 4 || idx === 7, [0.06, 0.09, 0.16]);
        curY += rowH;
      });

      curY += 3;

      // 3. 10-Box Category Summary Matrix
      const missingTooth = d.missing_tooth_clause ? 'Yes' : 'No';
      const waitingPeriod = d.waiting_period ? 'Yes' : 'No (Waived)';
      const summaryBoxes = [
        ['PREVENTATIVE', c.preventive || '100%'],
        ['BASIC', c.basic || '80%'],
        ['MAJOR', c.major || '60%'],
        ['ENDO', c.endo || c.basic || '80%'],
        ['ORAL SURG', c.oral_surgery || c.basic || '80%'],
        ['IMPLANTS', c.implants || 'NC'],
        ['NIGHT GUARD', c.night_guard || 'NC'],
        ['MISSING TOOTH', missingTooth],
        ['WAITING PER', waitingPeriod],
        ['ORTHO (' + trunc(oTerms, 7) + ')', oCov],
      ];
      const boxW = contentW / 10;
      const boxH = 20;
      summaryBoxes.forEach((b, i) => {
        const bx = marginX + i * boxW;
        drawRect(bx, curY, boxW, boxH, [0.95, 0.97, 1.0], [0.75, 0.8, 0.86], 0.4);
        drawText(trunc(b[0], 13), bx + 2.5, curY + 2.2, 5.5, true, [0.28, 0.33, 0.41]);
        drawText(trunc(b[1], 12), bx + 2.5, curY + 10.2, 7.2, true, [0.02, 0.38, 0.62]);
      });
      curY += boxH + 4;

      // 4. CDT Procedure Categories Table
      const prevCodes = [];
      const perioCodes = [];
      const restorativeCodes = [];
      const majorCodes = [];

      allCodes.forEach(cd => {
        const cat = categorizeProcedureCode(cd);
        if (cat === 'preventative') prevCodes.push(cd);
        else if (cat === 'periodontal') perioCodes.push(cd);
        else if (cat === 'restorative') restorativeCodes.push(cd);
        else if (cat === 'major') majorCodes.push(cd);
      });

      const sections = [
        { title: 'PREVENTATIVE PROCEDURES', list: prevCodes, bg: [0.98, 0.91, 0.95], fg: [0.61, 0.09, 0.3] },
        { title: 'PERIODONTAL PROCEDURES', list: perioCodes, bg: [0.92, 0.99, 0.96], fg: [0.02, 0.37, 0.27] },
        { title: 'RESTORATIVE PROCEDURES (D2391)', list: restorativeCodes, bg: [0.95, 0.91, 1.0], fg: [0.42, 0.13, 0.66] },
        { title: 'MAJOR PROCEDURES', list: majorCodes, bg: [0.88, 0.98, 0.93], fg: [0.02, 0.47, 0.34] },
      ];

      // Calculate dynamic row height so all rows fit on 1 page
      const totalCodeRows = prevCodes.length + perioCodes.length + restorativeCodes.length + majorCodes.length;
      const availH = pageH - curY - 22;
      const totalHeaderH = sections.length * 20;
      const cdtRowH = Math.max(9.2, Math.min(12.2, (availH - totalHeaderH) / Math.max(1, totalCodeRows)));
      const cdtFont = cdtRowH < 10.2 ? 6.1 : 6.6;

      // Columns: CDT Code (58), Description (162), Cov% (38), Ded (42), Freq (68), History (54), Elig (34), Notes (116) = 572
      const cCols = [58, 162, 38, 42, 68, 54, 34, 116];

      sections.forEach(sec => {
        // Section Banner
        drawRect(marginX, curY, contentW, 10.5, sec.bg, [0.75, 0.8, 0.86], 0.4);
        drawText(sec.title, marginX + 5, curY + 1.8, 6.8, true, sec.fg);
        curY += 10.5;

        // Column Headers
        drawRect(marginX, curY, contentW, 9.5, [0.93, 0.95, 0.98], [0.75, 0.8, 0.86], 0.4);
        const headers = ['CDT Code', 'Procedure Description (Locked)', 'Cov %', 'Ded', 'Frequency', 'History', 'Elig', 'Notes / Age / Downgrade'];
        let cx = marginX;
        headers.forEach((hText, ci) => {
          drawText(hText, cx + 3, curY + 1.6, 5.9, true, [0.2, 0.25, 0.33]);
          if (ci > 0) drawLine(cx, curY, cx, curY + 9.5, [0.8, 0.84, 0.88], 0.35);
          cx += cCols[ci];
        });
        curY += 9.5;

        if (sec.list.length === 0) {
          drawRect(marginX, curY, contentW, cdtRowH, [1, 1, 1], [0.82, 0.85, 0.9], 0.35);
          drawText('None specified in breakdown', marginX + 8, curY + 2, cdtFont, false, [0.5, 0.55, 0.62]);
          curY += cdtRowH;
        } else {
          sec.list.forEach((item, rIdx) => {
            const rBg = rIdx % 2 === 0 ? [1, 1, 1] : [0.985, 0.99, 1.0];
            drawRect(marginX, curY, contentW, cdtRowH, rBg, [0.82, 0.85, 0.9], 0.35);

            const eligStr = item.is_eligible ? 'Yes' : 'No';
            const eligColor = item.is_eligible ? [0.05, 0.48, 0.25] : [0.72, 0.11, 0.11];
            const noteParts = [];
            if (item.downgrade_rule && item.downgrade_rule.toLowerCase() !== 'none') noteParts.push(`DG: ${item.downgrade_rule}`);
            if (item.age_limit && item.age_limit.toLowerCase() !== 'none') noteParts.push(`Age: ${item.age_limit}`);
            if (item.notes && item.notes !== '-') noteParts.push(item.notes);

            const vals = [
              trunc(item.code || '', 14),
              trunc(item.description || '', 40),
              trunc(item.coverage_percentage || '0%', 8),
              item.deductible_applied ? 'Applies' : 'Waived',
              trunc(item.frequency_limitation || '-', 17),
              trunc(item.history_dates || 'None', 13),
              eligStr,
              trunc(noteParts.join(' | '), 30),
            ];

            let rx = marginX;
            vals.forEach((v, ci) => {
              const isBold = ci === 0 || ci === 2 || ci === 6;
              const colRgb = ci === 0 ? [0.01, 0.45, 0.72] : (ci === 6 ? eligColor : [0.08, 0.12, 0.2]);
              drawText(v, rx + 3, curY + 1.8, cdtFont, isBold, colRgb);
              if (ci > 0) drawLine(rx, curY, rx, curY + cdtRowH, [0.85, 0.88, 0.92], 0.3);
              rx += cCols[ci];
            });
            curY += cdtRowH;
          });
        }
      });

      // Footer
      drawText(`Generated by DentVerify AI (dentverify.com) • Verified by ${trunc(verifiedBy, 28)} • ${trunc(readiness, 38)}`, marginX, pageH - 12, 6.2, false, [0.4, 0.45, 0.52]);

      const streamContent = ops.join('\n');
      const objects = [];
      objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
      objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
      objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj`);
      objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj');
      objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj');
      objects.push(`6 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj`);

      let pdfStr = '%PDF-1.4\n';
      const offsets = [0];
      objects.forEach((obj) => {
        offsets.push(pdfStr.length);
        pdfStr += obj + '\n';
      });
      const xrefStart = pdfStr.length;
      pdfStr += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
      for (let i = 1; i <= objects.length; i++) {
        pdfStr += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
      }
      pdfStr += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

      const bytes = new Uint8Array(pdfStr.length);
      for (let i = 0; i < pdfStr.length; i++) {
        bytes[i] = pdfStr.charCodeAt(i) & 0xff;
      }
      return bytes;
    }

    function downloadCleanVectorPdf(data) {
      const targetData = data || currentAuditData || SAMPLE_BREAKDOWN_DATA;
      const pdfBytes = generateCleanBreakdownPdfBytes(targetData);
      const fileName = buildCleanPdfFilename(targetData);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      displayToast(`Downloaded clean PDF: ${fileName}`);
    }

    directDownloadPdfBtn?.addEventListener('click', () => {
      downloadCleanVectorPdf(currentAuditData || SAMPLE_BREAKDOWN_DATA);
    });

    downloadCleanPdfModalBtn?.addEventListener('click', () => {
      downloadCleanVectorPdf(currentAuditData || SAMPLE_BREAKDOWN_DATA);
    });

    const downloadExcelCsvBtn = document.getElementById('downloadExcelCsvBtn');
    downloadExcelCsvBtn?.addEventListener('click', () => {
      const data = currentAuditData || SAMPLE_BREAKDOWN_DATA;
      const csv = generateExcelCsv(data);
      const d = data.insurance_details || {};
      const safeName = (d.patient_name || 'Breakdown').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Dental_Breakdown_${safeName}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      displayToast('Excel CSV breakdown sheet downloaded!');
    });

    function generateExcelCsv(data) {
      if (!data) return '';
      const d = data.insurance_details || {};
      const c = data.coverage_levels || {};
      const meta = data.audit_meta || {};
      const verifiedBy = meta.verified_by_name || currentUser?.full_name || 'Clinic Staff';
      const verifiedAt = meta.verified_at || new Date().toLocaleDateString('en-US');
      const readinessStatus = meta.readiness_status || 'Complete / Ready for Appointment';
      const patientName = (d.patient_name && d.patient_name.trim() !== '' && !/^(none|n\/a|na|-)$/i.test(d.patient_name.trim())) ? d.patient_name.trim() : 'N/A';
      const patientDob = (d.dob && d.dob.trim() !== '' && !/^(none|n\/a|na|-)$/i.test(d.dob.trim())) ? d.dob.trim() : '';
      const pAge = patientDob ? calculateAge(patientDob) : null;
      const dobDisplay = patientDob ? `${patientDob}${pAge !== null ? ` (Age: ${pAge})` : ''}` : 'N/A';
      
      const grpCsv = (d.group_name && d.group_name.trim() !== '' && !/^(none|n\/a|na|-)$/i.test(d.group_name.trim())) ? d.group_name.trim() : '';
      const plnCsv = (d.plan_name && d.plan_name.trim() !== '' && !/^(none|n\/a|na|-)$/i.test(d.plan_name.trim())) ? d.plan_name.trim() : '';
      let groupPlanDisplay = 'N/A';
      if (grpCsv && plnCsv && grpCsv.toLowerCase() !== plnCsv.toLowerCase()) {
        groupPlanDisplay = `${grpCsv} • ${plnCsv}`;
      } else if (grpCsv) {
        groupPlanDisplay = grpCsv;
      } else if (plnCsv) {
        groupPlanDisplay = plnCsv;
      }
      const groupNumber = (d.group_number && d.group_number.trim() !== '' && !/^(none|n\/a|na|-)$/i.test(d.group_number.trim())) ? d.group_number.trim() : 'N/A';
      const carrier = d.carrier || 'Dental Insurance';
      const insAddress = (d.insurance_address && !/^(none|n\/a|na|-)$/i.test(d.insurance_address.trim())) ? d.insurance_address.trim() : 'N/A';
      const insPhone = (d.insurance_phone && !/^(none|n\/a|na|-)$/i.test(d.insurance_phone.trim())) ? d.insurance_phone.trim() : 'N/A';
      const payorId = (d.payor_id && !/^(none|n\/a|na|-)$/i.test(d.payor_id.trim())) ? d.payor_id.trim() : 'N/A';
      const network = d.network_status || 'In Network';
      const policyStatus = d.policy_status || 'Active';
      const effective = d.effective_date || '01/01/2026';
      const planBenefits = d.plan_benefits || 'Calendar Year';
      const feeSchedule = d.fee_schedule || (carrier + ' PPO');
      const paymentTo = d.payment_recipient || 'Office';
      const annualMax = fmtMoney(d.annual_maximum);
      const remainingMax = fmtMoney(d.remaining_maximum);
      const ded = fmtMoney(d.deductible_individual);
      const dedRemaining = fmtMoney(d.deductible_remaining);
      const prevToMax = d.preventive_applies_to_max ? 'Yes' : 'No';
      const dedScope = d.deductible_applies_to || 'Basic & Major only, Waived on Preventive';
      const orthoMax = c.ortho_max || '$1,000';
      const orthoRemaining = c.ortho_remaining || c.ortho_max || '$1,000';
      const orthoAgeLimit = c.ortho_age_limit || '14 Maximum';
      const orthoCoverage = c.ortho || '50%';
      const orthoPaymentTerms = c.ortho_payment_terms || 'Monthly';
      const missingTooth = d.missing_tooth_clause ? 'Yes' : 'No';
      const waitingPeriod = d.waiting_period ? (c.waiting_period_details || 'Yes') : ('No (' + (c.waiting_period_details || 'Basic 6mo Major 12') + ')');

      function csvCell(val) {
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      }

      let lines = [];
      lines.push([csvCell('DENTAL INSURANCE BENEFIT BREAKDOWN FORM')].join(','));
      lines.push([csvCell('Verified By:'), csvCell(`${verifiedBy} (${verifiedAt})`), csvCell('Appointment Status:'), csvCell(readinessStatus)].join(','));
      lines.push('');
      lines.push([csvCell('Subscriber / Patient Name:'), csvCell(patientName), csvCell('Subscriber DOB:'), csvCell(dobDisplay)].join(','));
      lines.push([csvCell('Employer / Group Name:'), csvCell(groupPlanDisplay), csvCell('Group #:'), csvCell(groupNumber)].join(','));
      lines.push([csvCell('Ins Company:'), csvCell(carrier), csvCell('Ins Ph #:'), csvCell(insPhone)].join(','));
      lines.push([csvCell('Ins Address (Claims):'), csvCell(insAddress), csvCell('Payor ID:'), csvCell(payorId)].join(','));
      lines.push([csvCell('Network Participation:'), csvCell(network), csvCell('Policy Status:'), csvCell(policyStatus)].join(','));
      lines.push([csvCell('Effective Date:'), csvCell(effective), csvCell('Plan Benefits:'), csvCell(planBenefits)].join(','));
      lines.push([csvCell('Insurance Payment goes to:'), csvCell(paymentTo), csvCell('Fee Schedule / Tier:'), csvCell(feeSchedule)].join(','));
      lines.push([csvCell('Yearly Maximum:'), csvCell(annualMax), csvCell('Remaining Benefits:'), csvCell(remainingMax)].join(','));
      lines.push([csvCell('Annual Max applies to preventative?:'), csvCell(prevToMax), csvCell('Individual Deductible:'), csvCell(ded)].join(','));
      lines.push([csvCell('Deductible Remaining:'), csvCell(dedRemaining), csvCell('Deductible Scope:'), csvCell(dedScope)].join(','));
      lines.push([csvCell('Ortho Max:'), csvCell(orthoMax), csvCell('Remaining Ortho:'), csvCell(orthoRemaining)].join(','));
      lines.push([csvCell('Ortho Age Limit:'), csvCell(orthoAgeLimit), csvCell('Ortho Coverage:'), csvCell(orthoCoverage)].join(','));
      lines.push([csvCell('Ortho Payment Terms:'), csvCell(orthoPaymentTerms)].join(','));
      lines.push('');
      lines.push([csvCell('SUMMARY CATEGORIES MATRIX')].join(','));
      lines.push([
        csvCell('Preventative'),
        csvCell('Basic'),
        csvCell('Major'),
        csvCell('ENDO'),
        csvCell('ORAL SURGERY'),
        csvCell('IMPLANTS D6010'),
        csvCell('NIGHT GUARD'),
        csvCell('Missing Tooth'),
        csvCell('Waiting Period'),
        csvCell('Ortho')
      ].join(','));
      lines.push([
        csvCell(c.preventive || '100%'),
        csvCell(c.basic || '80%'),
        csvCell(c.major || '60%'),
        csvCell(c.endo || c.basic || '80%'),
        csvCell(c.oral_surgery || c.basic || '80%'),
        csvCell(c.implants || 'NC'),
        csvCell(c.night_guard || 'NC'),
        csvCell(missingTooth),
        csvCell(waitingPeriod),
        csvCell(`${orthoCoverage} (Rem: ${orthoRemaining}, Age: ${orthoAgeLimit}, Terms: ${orthoPaymentTerms})`)
      ].join(','));
      lines.push('');

      const allCodes = (data.procedure_codes || []).slice();
      const prevCodes = [];
      const perioCodes = [];
      const restorativeCodes = [];
      const majorCodes = [];

      allCodes.forEach(cd => {
        const cat = categorizeProcedureCode(cd);
        if (cat === 'preventative') prevCodes.push(cd);
        else if (cat === 'periodontal') perioCodes.push(cd);
        else if (cat === 'restorative') restorativeCodes.push(cd);
        else if (cat === 'major') majorCodes.push(cd);
      });

      prevCodes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));
      perioCodes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));
      restorativeCodes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));
      majorCodes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));

      function appendCsvSection(title, list) {
        lines.push([csvCell(title)].join(','));
        lines.push([
          csvCell('CDT Code'),
          csvCell('Procedure Description'),
          csvCell('Coverage %'),
          csvCell('Deductible'),
          csvCell('Frequency'),
          csvCell('History Date'),
          csvCell('Eligible'),
          csvCell('Notes & Limitations')
        ].join(','));
        list.forEach(item => {
          lines.push([
            csvCell(item.code || ''),
            csvCell(item.description || ''),
            csvCell(item.coverage_percentage || ''),
            csvCell(item.deductible_applied ? 'Applies' : 'Waived'),
            csvCell(item.frequency_limitation || ''),
            csvCell(item.history_dates || 'None'),
            csvCell(item.is_eligible ? 'Yes' : 'No'),
            csvCell(item.notes || '')
          ].join(','));
        });
        lines.push('');
      }

      appendCsvSection('PREVENTATIVE PROCEDURES', prevCodes);
      appendCsvSection('PERIODONTAL PROCEDURES', perioCodes);
      appendCsvSection('RESTORATIVE PROCEDURES (D2391)', restorativeCodes);
      appendCsvSection('MAJOR PROCEDURES', majorCodes);

      return lines.join('\r\n');
    }

    function renderExcelBreakdownSheet(data) {
      if (!data) return;
      const d = data.insurance_details || {};
      const c = data.coverage_levels || {};
      const meta = data.audit_meta || {};
      const allCodes = (data.procedure_codes || []).slice();

      const verifiedBy = meta.verified_by_name || currentUser?.full_name || 'Clinic Staff';
      const verifiedAt = meta.verified_at || new Date().toLocaleDateString('en-US');
      const readinessStatus = meta.readiness_status || 'Complete / Ready for Appointment';

      const patientName = (d.patient_name && d.patient_name.trim() !== '' && !/^(none|n\/a|na|-)$/i.test(d.patient_name.trim())) ? d.patient_name.trim() : 'N/A';
      const patientDob = (d.dob && d.dob.trim() !== '' && !/^(none|n\/a|na|-)$/i.test(d.dob.trim())) ? d.dob.trim() : '';
      const pAge = patientDob ? calculateAge(patientDob) : null;
      const dobDisplay = patientDob ? `${patientDob}${pAge !== null ? ` (Age: ${pAge})` : ''}` : 'N/A';
      
      const grpSheet = (d.group_name && d.group_name.trim() !== '' && !/^(none|n\/a|na|-)$/i.test(d.group_name.trim())) ? d.group_name.trim() : '';
      const plnSheet = (d.plan_name && d.plan_name.trim() !== '' && !/^(none|n\/a|na|-)$/i.test(d.plan_name.trim())) ? d.plan_name.trim() : '';
      let groupPlanDisplay = 'N/A';
      if (grpSheet && plnSheet && grpSheet.toLowerCase() !== plnSheet.toLowerCase()) {
        groupPlanDisplay = `${grpSheet} • ${plnSheet}`;
      } else if (grpSheet) {
        groupPlanDisplay = grpSheet;
      } else if (plnSheet) {
        groupPlanDisplay = plnSheet;
      }
      const groupNumber = (d.group_number && d.group_number.trim() !== '' && !/^(none|n\/a|na|-)$/i.test(d.group_number.trim())) ? d.group_number.trim() : 'N/A';
      const carrier = d.carrier || 'Dental Insurance';
      const insAddress = (d.insurance_address && !/^(none|n\/a|na|-)$/i.test(d.insurance_address.trim())) ? d.insurance_address.trim() : 'N/A';
      const insPhone = (d.insurance_phone && !/^(none|n\/a|na|-)$/i.test(d.insurance_phone.trim())) ? d.insurance_phone.trim() : 'N/A';
      const payorId = (d.payor_id && !/^(none|n\/a|na|-)$/i.test(d.payor_id.trim())) ? d.payor_id.trim() : 'N/A';
      const network = d.network_status || 'In Network';
      const policyStatus = d.policy_status || 'Active';
      const effective = d.effective_date || '01/01/2026';
      const termedDate = d.termed_date || 'Active (None)';
      const planBenefits = d.plan_benefits || 'Calendar Year';
      const feeSchedule = d.fee_schedule || (carrier + ' PPO');
      const paymentTo = d.payment_recipient || 'Patient or Office';
      const annualMax = fmtMoney(d.annual_maximum);
      const remainingMax = fmtMoney(d.remaining_maximum);
      const ded = fmtMoney(d.deductible_individual);
      const dedRemaining = fmtMoney(d.deductible_remaining);
      const prevToMax = d.preventive_applies_to_max ? 'Yes' : 'No';
      const dedScope = d.deductible_applies_to || 'Basic & Major Services Only (Waived on Preventive)';
      const missingTooth = d.missing_tooth_clause ? 'Yes' : 'No';
      const waitingPeriod = d.waiting_period ? (c.waiting_period_details || 'Yes') : ('No (' + (c.waiting_period_details || 'Basic 6mo Major 12') + ')');

      const orthoMax = c.ortho_max || '$1,000';
      const orthoRemaining = c.ortho_remaining || c.ortho_max || '$1,000';
      const orthoAgeLimit = c.ortho_age_limit || '14 Maximum';
      const orthoCoverage = c.ortho || '50%';
      const orthoPaymentTerms = c.ortho_payment_terms || 'Monthly';

      // Sort all codes strictly in active clinic's sequence
      allCodes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));

      const prevCodes = [];
      const perioCodes = [];
      const restorativeCodes = [];
      const majorCodes = [];

      allCodes.forEach(cd => {
        const cat = categorizeProcedureCode(cd);
        if (cat === 'preventative') prevCodes.push(cd);
        else if (cat === 'periodontal') perioCodes.push(cd);
        else if (cat === 'restorative') restorativeCodes.push(cd);
        else if (cat === 'major') majorCodes.push(cd);
      });

      // Maintain exact clinical order within each of the 4 categories
      prevCodes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));
      perioCodes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));
      restorativeCodes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));
      majorCodes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));

      let html = `
        <div class="excel-sheet-doc">
          <div class="excel-sheet-header-title" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
            <span>DENTAL INSURANCE BENEFIT BREAKDOWN FORM</span>
            <span style="font-size: 9.5px; font-weight: 700; color: #38bdf8;">Verified by: ${escapeHtml(verifiedBy)} (${escapeHtml(verifiedAt)}) • ${escapeHtml(readinessStatus)}</span>
          </div>
          
          <!-- Patient Policy Header Table (Excel Gridline Aesthetic) -->
          <table class="excel-grid-table">
            <tr>
              <td class="excel-label-cell" style="width: 20%; font-weight: 700;">Subscriber Name:</td>
              <td class="excel-val-cell" style="width: 30%; font-weight: 700; color: #0284c7;">${escapeHtml(patientName)}</td>
              <td class="excel-label-cell" style="width: 22%; font-weight: 700;">Subscriber DOB:</td>
              <td class="excel-val-cell" style="width: 28%; font-weight: 700;">${escapeHtml(dobDisplay)}</td>
            </tr>
            <tr>
              <td class="excel-label-cell">Employer / Group Name:</td>
              <td class="excel-val-cell" style="font-weight: 700;">${escapeHtml(groupPlanDisplay)}</td>
              <td class="excel-label-cell">Group #:</td>
              <td class="excel-val-cell" style="font-weight: 700; font-family: var(--font-mono);">${escapeHtml(groupNumber)}</td>
            </tr>
            <tr>
              <td class="excel-label-cell">Ins Company (Locked):</td>
              <td class="excel-val-cell" style="font-weight: 700; color: #0f172a;">${escapeHtml(carrier)}</td>
              <td class="excel-label-cell">Ins Ph #:</td>
              <td class="excel-val-cell">${escapeHtml(insPhone)}</td>
            </tr>
            <tr>
              <td class="excel-label-cell">Ins Address (Locked):</td>
              <td class="excel-val-cell" style="color: #334155;">${escapeHtml(insAddress)}</td>
              <td class="excel-label-cell">PayorID:</td>
              <td class="excel-val-cell">${escapeHtml(payorId)}</td>
            </tr>
            <tr>
              <td class="excel-label-cell">Network Participation:</td>
              <td class="excel-val-cell" style="font-weight: 700;">${escapeHtml(network)}</td>
              <td class="excel-label-cell">Policy Status:</td>
              <td class="excel-val-cell" style="font-weight: 700; color: ${policyStatus.includes('Term') ? '#e11d48' : '#059669'};">${escapeHtml(policyStatus)}</td>
            </tr>
            <tr>
              <td class="excel-label-cell">Effective Date:</td>
              <td class="excel-val-cell">${escapeHtml(effective)}</td>
              <td class="excel-label-cell">Termed Date:</td>
              <td class="excel-val-cell">${escapeHtml(termedDate)}</td>
            </tr>
            <tr>
              <td class="excel-label-cell">Plan Benefits:</td>
              <td class="excel-val-cell">${escapeHtml(planBenefits)}</td>
              <td class="excel-label-cell">Fee Schedule / Tier:</td>
              <td class="excel-val-cell" style="font-weight: 700;">${escapeHtml(feeSchedule)}</td>
            </tr>
            <tr>
              <td class="excel-label-cell">Yearly Maximum:</td>
              <td class="excel-val-cell" style="font-weight: 700;">${escapeHtml(annualMax)}</td>
              <td class="excel-label-cell">Remaining Benefits:</td>
              <td class="excel-val-cell" style="font-weight: 700; color: #047857;">${escapeHtml(remainingMax)}</td>
            </tr>
            <tr>
              <td class="excel-label-cell">Insurance Payment goes to:</td>
              <td class="excel-val-cell">${escapeHtml(paymentTo)}</td>
              <td class="excel-label-cell">Annual Max applies to preventative?:</td>
              <td class="excel-val-cell">${escapeHtml(prevToMax)}</td>
            </tr>
            <tr>
              <td class="excel-label-cell">Individual Deductible:</td>
              <td class="excel-val-cell">${escapeHtml(ded)}</td>
              <td class="excel-label-cell">Deductible Remaining:</td>
              <td class="excel-val-cell">${escapeHtml(dedRemaining)}</td>
            </tr>
            <tr>
              <td class="excel-label-cell">Deductible Scope:</td>
              <td class="excel-val-cell">${escapeHtml(dedScope)}</td>
              <td class="excel-label-cell" style="font-weight: 700; color: #065f46;">Ortho Payment Terms:</td>
              <td class="excel-val-cell" style="font-weight: 700; color: #065f46;">${escapeHtml(orthoPaymentTerms)}</td>
            </tr>
            <tr style="background: #f0fdf4;">
              <td class="excel-label-cell" style="font-weight: 700; color: #065f46;">Ortho Max:</td>
              <td class="excel-val-cell" style="font-weight: 700; color: #065f46;">${escapeHtml(orthoMax)}</td>
              <td class="excel-label-cell" style="font-weight: 700; color: #065f46;">Remaining Ortho:</td>
              <td class="excel-val-cell" style="font-weight: 700; color: #047857;">${escapeHtml(orthoRemaining)}</td>
            </tr>
            <tr style="background: #f0fdf4;">
              <td class="excel-label-cell" style="font-weight: 600; color: #065f46;">Ortho Age Limit:</td>
              <td class="excel-val-cell">${escapeHtml(orthoAgeLimit)}</td>
              <td class="excel-label-cell" style="font-weight: 600; color: #065f46;">Ortho Coverage:</td>
              <td class="excel-val-cell">${escapeHtml(orthoCoverage)} (${escapeHtml(orthoPaymentTerms)})</td>
            </tr>
          </table>

          <!-- Excel Category Summary Matrix (10 Clinical Items) -->
          <table class="excel-grid-table">
            <tr>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">Preventative</div>
                <div class="cat-v">${escapeHtml(c.preventive || '100%')}</div>
                <div class="cat-sub">Ded: No</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">Basic</div>
                <div class="cat-v">${escapeHtml(c.basic || '80%')}</div>
                <div class="cat-sub">Ded: Yes</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">Major</div>
                <div class="cat-v">${escapeHtml(c.major || '60%')}</div>
                <div class="cat-sub">Ded: Yes</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">ENDO</div>
                <div class="cat-v">${escapeHtml(c.endo || c.basic || '80%')}</div>
                <div class="cat-sub">Root Canals</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">ORAL SURGERY</div>
                <div class="cat-v">${escapeHtml(c.oral_surgery || c.basic || '80%')}</div>
                <div class="cat-sub">Extractions</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">IMPLANTS D6010</div>
                <div class="cat-v">${escapeHtml(c.implants || 'NC')}</div>
                <div class="cat-sub">Placement</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">NIGHT GUARD</div>
                <div class="cat-v">${escapeHtml(c.night_guard || 'NC')}</div>
                <div class="cat-sub">D9944 Guard</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">Missing Tooth</div>
                <div class="cat-v" style="color: ${d.missing_tooth_clause ? '#b91c1c' : '#047857'};">${escapeHtml(missingTooth)}</div>
                <div class="cat-sub">Clause Active</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">Waiting Period</div>
                <div class="cat-v" style="color: ${d.waiting_period ? '#b91c1c' : '#047857'};">${escapeHtml(waitingPeriod)}</div>
                <div class="cat-sub">Status</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">Ortho (${escapeHtml(orthoPaymentTerms)})</div>
                <div class="cat-v">${escapeHtml(orthoCoverage)}</div>
                <div class="cat-sub">Rem: ${escapeHtml(orthoRemaining)} • ${escapeHtml(orthoAgeLimit)}</div>
              </td>
            </tr>
          </table>

          <!-- 1. PREVENTATIVE PROCEDURES (Pink Header) -->
          <table class="excel-grid-table">
            <thead>
              <tr>
                <th colspan="8" class="excel-section-banner excel-banner-pink" style="background: #fce7f3; color: #9d174d; font-weight: 800;">
                  PREVENTATIVE PROCEDURES
                </th>
              </tr>
              <tr>
                <th style="width: 11%;">CDT Code</th>
                <th style="width: 25%;">Procedure Description</th>
                <th style="width: 9%;">Coverage %</th>
                <th style="width: 8%;">Deductible</th>
                <th style="width: 15%;">Frequency</th>
                <th style="width: 11%;">History Date</th>
                <th style="width: 7%;">Eligible</th>
                <th style="width: 14%;">Notes & Limitations</th>
              </tr>
            </thead>
            <tbody>
              ${renderExcelRows(prevCodes)}
            </tbody>
          </table>

          <!-- 2. PERIODONTAL PROCEDURES (Green Header) -->
          <table class="excel-grid-table">
            <thead>
              <tr>
                <th colspan="8" class="excel-section-banner excel-banner-green" style="background: #ecfdf5; color: #065f46; font-weight: 800;">
                  PERIODONTAL PROCEDURES
                </th>
              </tr>
              <tr>
                <th style="width: 11%;">CDT Code</th>
                <th style="width: 25%;">Procedure Description</th>
                <th style="width: 9%;">Coverage %</th>
                <th style="width: 8%;">Deductible</th>
                <th style="width: 15%;">Frequency</th>
                <th style="width: 11%;">History Date</th>
                <th style="width: 7%;">Eligible</th>
                <th style="width: 14%;">Notes & Limitations</th>
              </tr>
            </thead>
            <tbody>
              ${renderExcelRows(perioCodes)}
            </tbody>
          </table>

          <!-- 3. RESTORATIVE PROCEDURES (D2391) (Purple Header) -->
          <table class="excel-grid-table">
            <thead>
              <tr>
                <th colspan="8" class="excel-section-banner excel-banner-purple" style="background: #f3e8ff; color: #6b21a8; font-weight: 800;">
                  RESTORATIVE PROCEDURES (D2391)
                </th>
              </tr>
              <tr>
                <th style="width: 11%;">CDT Code</th>
                <th style="width: 25%;">Procedure Description</th>
                <th style="width: 9%;">Coverage %</th>
                <th style="width: 8%;">Deductible</th>
                <th style="width: 15%;">Frequency</th>
                <th style="width: 11%;">History Date</th>
                <th style="width: 7%;">Eligible</th>
                <th style="width: 14%;">Notes & Limitations</th>
              </tr>
            </thead>
            <tbody>
              ${renderExcelRows(restorativeCodes)}
            </tbody>
          </table>

          <!-- 4. MAJOR PROCEDURES (Emerald Header) -->
          <table class="excel-grid-table">
            <thead>
              <tr>
                <th colspan="8" class="excel-section-banner excel-banner-green" style="background: #d1fae5; color: #047857; font-weight: 800;">
                  MAJOR PROCEDURES
                </th>
              </tr>
              <tr>
                <th style="width: 11%;">CDT Code</th>
                <th style="width: 25%;">Procedure Description</th>
                <th style="width: 9%;">Coverage %</th>
                <th style="width: 8%;">Deductible</th>
                <th style="width: 15%;">Frequency</th>
                <th style="width: 11%;">History Date</th>
                <th style="width: 7%;">Eligible</th>
                <th style="width: 14%;">Notes & Limitations</th>
              </tr>
            </thead>
            <tbody>
              ${renderExcelRows(majorCodes)}
            </tbody>
          </table>

          <div style="font-size: 9.5px; color: #64748b; text-align: right; margin-top: 6px;">
            Generated by DentVerify AI (dentverify.com) • Verified by ${escapeHtml(verifiedBy)} (${escapeHtml(verifiedAt)}) • ${escapeHtml(readinessStatus)}
          </div>
        </div>
      `;

      const sheetContainer = document.getElementById('excelSheetContainer');
      const printWrapper = document.getElementById('excelPrintWrapper');
      if (sheetContainer) sheetContainer.innerHTML = html;
      if (printWrapper) printWrapper.innerHTML = html;
    }

    function renderExcelRows(codesList) {
      if (!codesList || codesList.length === 0) {
        return `<tr><td colspan="8" style="text-align: center; color: #94a3b8; font-style: italic; padding: 6px;">None specified in breakdown</td></tr>`;
      }
      return codesList.map(item => {
        const isElig = item.is_eligible === true;
        const eligHtml = isElig
          ? `<span style="color: #15803d; font-weight: 700;">Yes</span>`
          : `<span style="color: #b91c1c; font-weight: 700; background: #fee2e2; padding: 1px 4px; border-radius: 2px;">No</span>`;

        return `
          <tr>
            <td style="font-weight: 700; color: #0284c7; font-family: monospace;">${escapeHtml(item.code)}</td>
            <td style="font-weight: 600;">${escapeHtml(item.description)}</td>
            <td style="text-align: center; font-weight: 700;">${escapeHtml(item.coverage_percentage || '0%')}</td>
            <td style="text-align: center;">${item.deductible_applied ? 'Applies' : 'Waived'}</td>
            <td>${escapeHtml(item.frequency_limitation || '-')}</td>
            <td style="font-family: monospace;">${escapeHtml(item.history_dates || 'None')}</td>
            <td style="text-align: center;">${eligHtml}</td>
            <td>
              ${item.downgrade_rule && item.downgrade_rule.toLowerCase() !== 'none' ? `<strong style="color: #b45309;">${escapeHtml(item.downgrade_rule)}</strong> ` : ''}
              ${item.age_limit && item.age_limit.toLowerCase() !== 'none' ? `<span style="color: #6366f1; font-weight: 600;">Age: ${escapeHtml(item.age_limit)}</span> ` : ''}
              ${escapeHtml(item.notes || '')}
            </td>
          </tr>
        `;
      }).join('');
    }

    // ==========================================
    // PER-CLINIC CDT CHECKLIST, SEQUENCE ORDERING & AI PROMPT SETTINGS
    // ==========================================
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
    const settingSystemInstruction = document.getElementById('settingSystemInstruction');
    const settingCustomPrompt = document.getElementById('settingCustomPrompt');
    const btnRestoreDefaults = document.getElementById('btnRestoreDefaults');
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    const btnSyncChecklistToPrompt = document.getElementById('btnSyncChecklistToPrompt');
    const settingsTabBtns = document.querySelectorAll('.settings-tab-btn');
    const settingsTabPanes = document.querySelectorAll('.settings-tab-pane');

    // Tab switching in Settings modal
    settingsTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        settingsTabBtns.forEach(b => b.classList.remove('active'));
        settingsTabPanes.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.dataset.tab;
        document.getElementById(targetId)?.classList.add('active');
      });
    });

    // Fetch and sync active clinic's CDT checklist sequence & AI prompt settings
    async function loadPromptSettings() {
      try {
        const res = await fetch('/api/prompts/default');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.enabledCdtCodes) && data.enabledCdtCodes.length > 0) {
            activeEnabledCdtCodes = data.enabledCdtCodes.slice();
          } else {
            activeEnabledCdtCodes = DEFAULT_ENABLED_CDT_CODES.slice();
          }
          if (settingSystemInstruction) settingSystemInstruction.value = data.systemInstruction || '';
          if (settingCustomPrompt) settingCustomPrompt.value = data.customPrompt || '';
          try {
            if (data.systemInstruction) localStorage.setItem('dentverify_system_instruction', data.systemInstruction);
            if (data.customPrompt) localStorage.setItem('dentverify_custom_prompt', data.customPrompt);
          } catch (e) {}
        }
      } catch (e) {
        console.warn('Could not load clinic prompt settings:', e);
      }
    }

    // Render Interactive Per-Clinic CDT Checklist & Sequence Ordering (while keeping Meanings Locked)
    function renderCdtMemoryDictionary() {
      const container = document.getElementById('cdtMemoryDictionaryList');
      if (!container) return;

      const allDictKeys = Object.keys(CDT_CODE_DICTIONARY);
      const enabledSet = new Set(activeEnabledCdtCodes);
      const orderedKeys = [
        ...activeEnabledCdtCodes.filter(k => CDT_CODE_DICTIONARY[k]),
        ...allDictKeys.filter(k => !enabledSet.has(k)),
      ];

      container.innerHTML = orderedKeys.map((code) => {
        const meaning = CDT_CODE_DICTIONARY[code] || '-';
        const enabledIdx = activeEnabledCdtCodes.indexOf(code);
        const isChecked = enabledIdx !== -1;
        const seqLabel = isChecked ? `#${enabledIdx + 1}` : 'Off';

        return `
          <div class="cdt-checklist-row" data-code="${escapeHtml(code)}" style="display: flex; align-items: center; justify-content: space-between; gap: 0.65rem; padding: 0.44rem 0.65rem; border-bottom: 1px solid rgba(148, 163, 184, 0.12); font-size: 0.78rem; background: ${isChecked ? 'rgba(16, 185, 129, 0.05)' : 'transparent'};">
            <div style="display: flex; align-items: center; gap: 0.55rem; flex: 1; min-width: 0;">
              <input type="checkbox" class="cdt-check-toggle" data-code="${escapeHtml(code)}" ${isChecked ? 'checked' : ''} style="width: 15px; height: 15px; accent-color: #10b981; cursor: pointer;" title="Enable/Disable this CDT code for this clinic">
              <span style="min-width: 30px; text-align: center; font-family: var(--font-mono); font-size: 0.7rem; font-weight: 800; color: ${isChecked ? '#34d399' : '#64748b'};">${seqLabel}</span>
              <span class="cdt-badge" style="min-width: 105px; text-align: center;">${escapeHtml(code)}</span>
              <span style="color: ${isChecked ? '#f8fafc' : '#94a3b8'}; font-weight: 600; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(meaning)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0;">
              ${isChecked ? `
                <button type="button" class="btn-action-ghost cdt-move-up" data-code="${escapeHtml(code)}" ${enabledIdx === 0 ? 'disabled' : ''} style="padding: 2px 7px; font-size: 0.7rem;" title="Move Up in Sequence">↑</button>
                <button type="button" class="btn-action-ghost cdt-move-down" data-code="${escapeHtml(code)}" ${enabledIdx === activeEnabledCdtCodes.length - 1 ? 'disabled' : ''} style="padding: 2px 7px; font-size: 0.7rem;" title="Move Down in Sequence">↓</button>
              ` : ''}
              <span style="font-size: 0.64rem; color: #10b981; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 7px; border-radius: 999px; font-weight: 700; white-space: nowrap;">🔒 Locked</span>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.cdt-check-toggle').forEach(cb => {
        cb.addEventListener('change', () => {
          const code = cb.dataset.code;
          if (!code) return;
          if (cb.checked) {
            if (!activeEnabledCdtCodes.includes(code)) {
              activeEnabledCdtCodes.push(code);
            }
          } else {
            activeEnabledCdtCodes = activeEnabledCdtCodes.filter(c => c !== code);
          }
          renderCdtMemoryDictionary();
        });
      });

      container.querySelectorAll('.cdt-move-up').forEach(btn => {
        btn.addEventListener('click', () => {
          const code = btn.dataset.code;
          const idx = activeEnabledCdtCodes.indexOf(code);
          if (idx > 0) {
            const tmp = activeEnabledCdtCodes[idx - 1];
            activeEnabledCdtCodes[idx - 1] = activeEnabledCdtCodes[idx];
            activeEnabledCdtCodes[idx] = tmp;
            renderCdtMemoryDictionary();
          }
        });
      });

      container.querySelectorAll('.cdt-move-down').forEach(btn => {
        btn.addEventListener('click', () => {
          const code = btn.dataset.code;
          const idx = activeEnabledCdtCodes.indexOf(code);
          if (idx !== -1 && idx < activeEnabledCdtCodes.length - 1) {
            const tmp = activeEnabledCdtCodes[idx + 1];
            activeEnabledCdtCodes[idx + 1] = activeEnabledCdtCodes[idx];
            activeEnabledCdtCodes[idx] = tmp;
            renderCdtMemoryDictionary();
          }
        });
      });
    }

    if (btnSyncChecklistToPrompt) {
      btnSyncChecklistToPrompt.addEventListener('click', () => {
        if (!settingCustomPrompt) return;
        const numberedLines = activeEnabledCdtCodes.map((code, idx) => {
          const meaning = CDT_CODE_DICTIONARY[code] || 'Dental Procedure';
          return `${idx + 1}. ${code} - ${meaning}`;
        }).join('\n');

        const curVal = settingCustomPrompt.value || '';
        const listRegex = /1\.\s*D\d{4}[\s\S]*?(?=\n\nCRITICAL DATA GROUNDING|\nCRITICAL DATA GROUNDING|$)/i;
        if (listRegex.test(curVal)) {
          settingCustomPrompt.value = curVal.replace(listRegex, numberedLines);
        } else {
          settingCustomPrompt.value = numberedLines + '\n\n' + curVal;
        }
        displayToast(`Synced ${activeEnabledCdtCodes.length} checked CDT codes & sequence to AI Prompt!`);
      });
    }

    openSettingsBtn?.addEventListener('click', async () => {
      await loadPromptSettings();
      renderCdtMemoryDictionary();
      settingsModal.classList.add('active');
    });

    // Close Settings Modal
    closeSettingsModalBtn?.addEventListener('click', () => {
      settingsModal.classList.remove('active');
    });

    settingsModal?.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
      }
    });

    // Save Clinic CDT Checklist Sequence & AI Prompt Settings to PostgreSQL
    btnSaveSettings?.addEventListener('click', async () => {
      const sysVal = settingSystemInstruction.value.trim();
      const prVal = settingCustomPrompt.value.trim();
      if (sysVal) localStorage.setItem('dentverify_system_instruction', sysVal);
      if (prVal) localStorage.setItem('dentverify_custom_prompt', prVal);

      try {
        await fetch('/api/clinic-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: sysVal,
            customPrompt: prVal,
            enabledCdtCodes: activeEnabledCdtCodes,
          }),
        });
      } catch (e) {
        console.warn('Could not persist clinic AI settings to server:', e);
      }

      if (currentAuditData) {
        renderCdtTable();
        renderExcelBreakdownSheet(currentAuditData);
      }
      settingsModal.classList.remove('active');
      displayToast('Saved Clinic CDT Checklist Sequence & AI Directives!');
    });

    // Restore Factory Defaults
    btnRestoreDefaults?.addEventListener('click', async () => {
      activeEnabledCdtCodes = DEFAULT_ENABLED_CDT_CODES.slice();
      localStorage.removeItem('dentverify_system_instruction');
      localStorage.removeItem('dentverify_custom_prompt');
      try {
        await fetch('/api/clinic-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: '',
            customPrompt: '',
            enabledCdtCodes: DEFAULT_ENABLED_CDT_CODES,
          }),
        });
        await loadPromptSettings();
        renderCdtMemoryDictionary();
        displayToast('Restored default CDT Checklist Sequence & AI prompt directives.');
      } catch (e) {
        displayToast('Could not restore default prompts.');
      }
    });

    // ==========================================
    // DEDICATED INSURANCE DIRECTORY & MASTER CLAIMS HUBS UI
    // ==========================================
    const openInsuranceDirectoryBtn = document.getElementById('openInsuranceDirectoryBtn');
    const insuranceDirectoryModal = document.getElementById('insuranceDirectoryModal');
    const closeInsuranceDirectoryModalBtn = document.getElementById('closeInsuranceDirectoryModalBtn');
    const dirCloseFooterBtn = document.getElementById('dirCloseFooterBtn');
    const payerDirectorySearchInput = document.getElementById('payerDirectorySearchInput');
    const payerParentFilter = document.getElementById('payerParentFilter');
    const dirToggleBulkImportBtn = document.getElementById('dirToggleBulkImportBtn');
    const dirBulkImportPanel = document.getElementById('dirBulkImportPanel');
    const dirBulkImportTextarea = document.getElementById('dirBulkImportTextarea');
    const dirCancelBulkImportBtn = document.getElementById('dirCancelBulkImportBtn');
    const dirProcessBulkImportBtn = document.getElementById('dirProcessBulkImportBtn');
    const dirToggleAddBtn = document.getElementById('dirToggleAddBtn');
    const dirAddPayerFormPanel = document.getElementById('dirAddPayerFormPanel');
    const dirNewParentCarrier = document.getElementById('dirNewParentCarrier');
    const dirNewCarrierName = document.getElementById('dirNewCarrierName');
    const dirNewPayorId = document.getElementById('dirNewPayorId');
    const dirNewAddress = document.getElementById('dirNewAddress');
    const dirNewPhone = document.getElementById('dirNewPhone');
    const dirNewNetwork = document.getElementById('dirNewNetwork');
    const dirNewFeeSchedule = document.getElementById('dirNewFeeSchedule');
    const dirNewMatchKeys = document.getElementById('dirNewMatchKeys');
    const dirCancelAddBtn = document.getElementById('dirCancelAddBtn');
    const dirSavePayerBtn = document.getElementById('dirSavePayerBtn');
    const dirPayerListContainer = document.getElementById('dirPayerListContainer');
    const dirResetDefaultsBtn = document.getElementById('dirResetDefaultsBtn');
    const openPayerDirectoryQuickBtn = document.getElementById('openPayerDirectoryQuickBtn');

    function renderDedicatedPayerDirectory() {
      if (!dirPayerListContainer) return;
      dirPayerListContainer.innerHTML = '';

      const list = getPayerDirectory();
      const q = (payerDirectorySearchInput?.value || '').trim().toLowerCase();
      const parentVal = payerParentFilter?.value || 'ALL';

      const filtered = list.filter(p => {
        const parentStr = (p.parentCarrier || '').toLowerCase();
        const nameStr = (p.name || p.carrier || '').toLowerCase();
        const keysStr = Array.isArray(p.matchKeys) ? p.matchKeys.join(' ').toLowerCase() : '';

        if (parentVal !== 'ALL') {
          const pv = parentVal.toLowerCase();
          if (pv === 'delta dental') {
            if (!parentStr.includes('delta') && !nameStr.includes('delta')) return false;
          } else if (pv === 'other') {
            if (parentStr.includes('delta') || parentStr.includes('metlife') || parentStr.includes('cigna') || parentStr.includes('guardian') || parentStr.includes('aetna')) return false;
          } else {
            if (!parentStr.includes(pv) && !nameStr.includes(pv)) return false;
          }
        }

        if (!q) return true;
        return nameStr.includes(q) ||
               parentStr.includes(q) ||
               keysStr.includes(q) ||
               (p.address || '').toLowerCase().includes(q) ||
               (p.payorId || '').toLowerCase().includes(q) ||
               (p.phone || '').toLowerCase().includes(q) ||
               (p.feeSchedule || '').toLowerCase().includes(q) ||
               (p.network || '').toLowerCase().includes(q);
      });

      if (filtered.length === 0) {
        dirPayerListContainer.innerHTML = `
          <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.78rem;">
            No insurance hubs or sub-portals found matching your filter.
          </div>
        `;
        return;
      }

      // Only Clinic Admin & Website Owner can edit/add/delete/reset Insurance Directory Hubs
      const canManageDirectory = Boolean(currentUser && (currentUser.role === 'owner' || currentUser.role === 'clinic_admin'));
      if (dirToggleAddBtn) dirToggleAddBtn.style.display = canManageDirectory ? 'inline-flex' : 'none';
      if (dirToggleBulkImportBtn) dirToggleBulkImportBtn.style.display = canManageDirectory ? 'inline-flex' : 'none';
      if (dirResetDefaultsBtn) dirResetDefaultsBtn.style.display = canManageDirectory ? 'inline-flex' : 'none';

      filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'payer-directory-card';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'stretch';
        const isOut = (p.network || 'In-Network').toLowerCase().includes('out');
        const netLabel = isOut ? 'Out-of-Network' : 'In-Network';
        const parentGroup = p.parentCarrier || 'Standard Carrier';
        const isDelta = parentGroup.toLowerCase().includes('delta') || (p.name || '').toLowerCase().includes('delta');
        const feeSched = p.feeSchedule || (p.name + ' PPO');
        const matchKeysStr = Array.isArray(p.matchKeys) ? p.matchKeys.join(', ') : '';

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; width: 100%; flex-wrap: wrap;">
            <div class="payer-card-info" style="flex: 1;">
              <div class="payer-card-name" style="flex-wrap: wrap; gap: 0.45rem;">
                <span class="payer-parent-badge ${isDelta ? 'delta' : ''}">${escapeHtml(parentGroup)}</span>
                <span style="font-weight: 700; color: #fff;">${escapeHtml(p.name)}</span>
                <button type="button" class="payer-network-toggle-badge ${isOut ? 'out' : 'in'}" data-id="${p.id}" title="${canManageDirectory ? 'Click to pre-set In-Network / Out-of-Network for this Insurance Hub' : 'Pre-set Network Status'}">
                  ${netLabel}
                </button>
                <span style="font-size: 0.68rem; color: #a78bfa; background: rgba(139, 92, 246, 0.14); border: 1px solid rgba(139, 92, 246, 0.35); padding: 1px 7px; border-radius: 999px; font-weight: 700;">Fee: ${escapeHtml(feeSched)}</span>
              </div>
              <div class="payer-card-addr">${escapeHtml(p.address)}</div>
              <div class="payer-card-meta" style="flex-wrap: wrap;">
                <span>Ph: ${escapeHtml(p.phone || 'N/A')}</span>
                <span>•</span>
                <span>Payor ID: <strong style="color: #38bdf8;">${escapeHtml(p.payorId || 'N/A')}</strong></span>
                ${matchKeysStr ? `<span>•</span><span style="color: #94a3b8; font-size: 0.68rem;">🔗 Wired States/Aliases: <strong style="color: #cbd5e1;">${escapeHtml(matchKeysStr.length > 75 ? matchKeysStr.slice(0, 75) + '...' : matchKeysStr)}</strong></span>` : ''}
              </div>
            </div>
            <div style="display: flex; gap: 0.4rem; align-items: center;">
              ${canManageDirectory ? `
                <button type="button" class="btn-action-ghost btn-edit-payer" style="padding: 0.28rem 0.55rem; font-size: 0.7rem;" title="Edit Master Hub details & wired states">
                  ✏️ Edit Hub
                </button>
              ` : ''}
              <button type="button" class="btn-apply-payer" data-id="${p.id || ''}" title="Apply this Master Hub's locked Address, Phone #, Payor ID, Network Status, and Fee Schedule to the active breakdown">
                Apply to Policy
              </button>
              ${canManageDirectory ? `
                <button type="button" class="del-payer-btn" data-id="${p.id}" title="Remove from clinic directory" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              ` : ''}
            </div>
          </div>
          ${canManageDirectory ? `
          <div class="payer-inline-edit-panel" style="display: none; margin-top: 0.65rem; padding-top: 0.65rem; border-top: 1px solid rgba(255,255,255,0.08);">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(165px, 1fr)); gap: 0.5rem; margin-bottom: 0.5rem;">
              <div>
                <label style="font-size: 0.66rem; color: #94a3b8; display: block; margin-bottom: 2px;">Parent Group</label>
                <input type="text" class="table-search-input edit-p-parent" value="${escapeHtml(parentGroup)}" style="width: 100%; font-size: 0.74rem; padding: 0.3rem 0.5rem;">
              </div>
              <div>
                <label style="font-size: 0.66rem; color: #94a3b8; display: block; margin-bottom: 2px;">Master Hub / Carrier Name</label>
                <input type="text" class="table-search-input edit-p-name" value="${escapeHtml(p.name)}" style="width: 100%; font-size: 0.74rem; padding: 0.3rem 0.5rem;">
              </div>
              <div>
                <label style="font-size: 0.66rem; color: #94a3b8; display: block; margin-bottom: 2px;">Payor ID</label>
                <input type="text" class="table-search-input edit-p-payorid" value="${escapeHtml(p.payorId || '')}" style="width: 100%; font-size: 0.74rem; padding: 0.3rem 0.5rem;">
              </div>
              <div>
                <label style="font-size: 0.66rem; color: #94a3b8; display: block; margin-bottom: 2px;">Phone Number</label>
                <input type="text" class="table-search-input edit-p-phone" value="${escapeHtml(p.phone || '')}" style="width: 100%; font-size: 0.74rem; padding: 0.3rem 0.5rem;">
              </div>
              <div>
                <label style="font-size: 0.66rem; color: #94a3b8; display: block; margin-bottom: 2px;">Pre-Set Fee Schedule</label>
                <input type="text" class="table-search-input edit-p-feesched" value="${escapeHtml(feeSched)}" style="width: 100%; font-size: 0.74rem; padding: 0.3rem 0.5rem;">
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: flex-end; flex-wrap: wrap;">
              <div style="flex: 1; min-width: 210px;">
                <label style="font-size: 0.66rem; color: #94a3b8; display: block; margin-bottom: 2px;">Claims Mailing Address (Locked on Breakdown)</label>
                <input type="text" class="table-search-input edit-p-addr" value="${escapeHtml(p.address || '')}" style="width: 100%; font-size: 0.74rem; padding: 0.3rem 0.5rem;">
              </div>
              <div style="flex: 1; min-width: 210px;">
                <label style="font-size: 0.66rem; color: #94a3b8; display: block; margin-bottom: 2px;">Wired States / Plan Aliases (comma-separated)</label>
                <input type="text" class="table-search-input edit-p-matchkeys" value="${escapeHtml(matchKeysStr)}" style="width: 100%; font-size: 0.74rem; padding: 0.3rem 0.5rem;">
              </div>
              <button type="button" class="btn-verify-primary btn-save-payer-edit" style="padding: 0.35rem 0.85rem; font-size: 0.72rem;">💾 Save Hub</button>
            </div>
          </div>
          ` : ''}
        `;

        const editBtn = card.querySelector('.btn-edit-payer');
        const editPanel = card.querySelector('.payer-inline-edit-panel');
        if (editBtn && editPanel) {
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = editPanel.style.display === 'none';
            editPanel.style.display = isHidden ? 'block' : 'none';
            editBtn.textContent = isHidden ? '✕ Close' : '✏️ Edit Hub';
          });
        }

        const saveEditBtn = card.querySelector('.btn-save-payer-edit');
        if (saveEditBtn) {
          saveEditBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const allPayers = getPayerDirectory();
            const targetPayer = allPayers.find(item => item.id === p.id);
            if (targetPayer) {
              targetPayer.parentCarrier = card.querySelector('.edit-p-parent').value.trim() || 'Standard Carrier';
              targetPayer.name = card.querySelector('.edit-p-name').value.trim() || targetPayer.name;
              targetPayer.carrier = targetPayer.name;
              targetPayer.payorId = card.querySelector('.edit-p-payorid').value.trim() || 'N/A';
              targetPayer.phone = card.querySelector('.edit-p-phone').value.trim() || 'N/A';
              targetPayer.feeSchedule = card.querySelector('.edit-p-feesched').value.trim() || (targetPayer.name + ' PPO');
              targetPayer.address = card.querySelector('.edit-p-addr').value.trim() || 'N/A';
              const rawKeys = card.querySelector('.edit-p-matchkeys').value.trim();
              targetPayer.matchKeys = rawKeys
                ? rawKeys.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
                : [targetPayer.name.toLowerCase()];
              await savePayerDirectory(allPayers);
              renderDedicatedPayerDirectory();
              if (currentAuditData) {
                renderReportDashboard(currentAuditData);
              }
              displayToast(`Updated Master Hub: ${targetPayer.name}!`);
            }
          });
        }

        // Network toggle badge click (Clinic Admin / Owner)
        const netBtn = card.querySelector('.payer-network-toggle-badge');
        if (netBtn && canManageDirectory) {
          netBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const allPayers = getPayerDirectory();
            const targetPayer = allPayers.find(item => item.id === p.id);
            if (targetPayer) {
              const curNet = targetPayer.network || 'In-Network';
              const nextNet = curNet.toLowerCase().includes('out') ? 'In-Network' : 'Out-of-Network';
              targetPayer.network = nextNet;
              targetPayer.networkStatus = nextNet;
              await savePayerDirectory(allPayers);
              renderDedicatedPayerDirectory();

              if (currentAuditData && currentAuditData.insurance_details && currentAuditData.insurance_details.carrier) {
                const c = currentAuditData.insurance_details.carrier.toLowerCase();
                if (c.includes(targetPayer.name.toLowerCase()) || targetPayer.name.toLowerCase().includes(c)) {
                  currentAuditData.insurance_details.network_status = nextNet;
                  renderReportDashboard(currentAuditData);
                  renderExcelBreakdownSheet(currentAuditData);
                  if (pmsModal && pmsModal.classList.contains('active')) buildPmsNote();
                }
              }
              displayToast(`${targetPayer.name} pre-set to ${nextNet} for this clinic!`);
            }
          });
        }

        const applyBtn = card.querySelector('.btn-apply-payer');
        if (applyBtn) {
          applyBtn.addEventListener('click', () => {
            applyPayerToCurrentAudit(p);
          });
        }

        const delBtn = card.querySelector('.del-payer-btn');
        if (delBtn) {
          delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const list = getPayerDirectory().filter(item => item.id !== p.id);
            await savePayerDirectory(list);
            renderDedicatedPayerDirectory();
            displayToast(`Removed ${p.name} from clinic directory.`);
          });
        }

        dirPayerListContainer.appendChild(card);
      });
    }

    function applyPayerToCurrentAudit(payer) {
      if (!currentAuditData) {
        displayToast('No active breakdown loaded. Upload or load a breakdown first.');
        return;
      }
      if (!currentAuditData.insurance_details) currentAuditData.insurance_details = {};
      currentAuditData.insurance_details.carrier = payer.name;
      currentAuditData.insurance_details.insurance_address = payer.address;
      currentAuditData.insurance_details.insurance_phone = payer.phone;
      currentAuditData.insurance_details.payor_id = payer.payorId;
      if (payer.network) {
        currentAuditData.insurance_details.network_status = payer.network;
      }
      if (payer.feeSchedule) {
        currentAuditData.insurance_details.fee_schedule = payer.feeSchedule;
      }

      renderReportDashboard(currentAuditData);
      renderExcelBreakdownSheet(currentAuditData);
      if (pmsModal && pmsModal.classList.contains('active')) buildPmsNote();
      persistActiveBreakdownToDb();
      if (insuranceDirectoryModal) insuranceDirectoryModal.classList.remove('active');
      displayToast(`Wired to ${payer.name} (${payer.network || 'In-Network'} • Fee: ${payer.feeSchedule || 'PPO'})!`);
    }

    function openInsuranceDirectory() {
      renderDedicatedPayerDirectory();
      if (insuranceDirectoryModal) insuranceDirectoryModal.classList.add('active');
    }

    if (openInsuranceDirectoryBtn) {
      openInsuranceDirectoryBtn.addEventListener('click', openInsuranceDirectory);
    }

    if (openPayerDirectoryQuickBtn) {
      openPayerDirectoryQuickBtn.addEventListener('click', openInsuranceDirectory);
    }

    if (closeInsuranceDirectoryModalBtn) {
      closeInsuranceDirectoryModalBtn.addEventListener('click', () => {
        if (insuranceDirectoryModal) insuranceDirectoryModal.classList.remove('active');
      });
    }

    if (dirCloseFooterBtn) {
      dirCloseFooterBtn.addEventListener('click', () => {
        if (insuranceDirectoryModal) insuranceDirectoryModal.classList.remove('active');
      });
    }

    if (insuranceDirectoryModal) {
      insuranceDirectoryModal.addEventListener('click', (e) => {
        if (e.target === insuranceDirectoryModal) {
          insuranceDirectoryModal.classList.remove('active');
        }
      });
    }

    if (payerDirectorySearchInput) {
      payerDirectorySearchInput.addEventListener('input', renderDedicatedPayerDirectory);
    }

    if (payerParentFilter) {
      payerParentFilter.addEventListener('change', renderDedicatedPayerDirectory);
    }

    // Add Master Claims Hub / Sub-Portal Form
    if (dirToggleAddBtn && dirAddPayerFormPanel) {
      dirToggleAddBtn.addEventListener('click', () => {
        const isHidden = dirAddPayerFormPanel.style.display === 'none';
        dirAddPayerFormPanel.style.display = isHidden ? 'block' : 'none';
        if (dirBulkImportPanel) dirBulkImportPanel.style.display = 'none';
        dirToggleAddBtn.textContent = isHidden ? '✕ Close Form' : '+ Add Master Hub / Portal';
      });
    }

    if (dirCancelAddBtn && dirAddPayerFormPanel) {
      dirCancelAddBtn.addEventListener('click', () => {
        dirAddPayerFormPanel.style.display = 'none';
        if (dirToggleAddBtn) dirToggleAddBtn.textContent = '+ Add Master Hub / Portal';
      });
    }

    if (dirSavePayerBtn) {
      dirSavePayerBtn.addEventListener('click', async () => {
        const parentCarrier = dirNewParentCarrier?.value.trim() || 'Delta Dental Ins';
        const name = dirNewCarrierName?.value.trim();
        const address = dirNewAddress?.value.trim();
        const phone = dirNewPhone?.value.trim() || 'N/A';
        const payorId = dirNewPayorId?.value.trim() || 'N/A';
        const network = dirNewNetwork?.value || 'In-Network';
        const feeSchedule = dirNewFeeSchedule?.value.trim() || (name ? name + ' PPO' : 'Delta Dental PPO');
        const rawMatchKeys = dirNewMatchKeys?.value.trim() || '';
        const matchKeys = rawMatchKeys
          ? rawMatchKeys.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
          : [String(name || '').toLowerCase()];

        if (!name || !address) {
          await openCustomNotice('Missing Hub Details', 'Please enter both the Master Hub/Carrier Name and Claims Address.');
          return;
        }

        const list = getPayerDirectory();
        list.unshift({
          id: 'payer_custom_' + Date.now(),
          parentCarrier,
          name,
          carrier: name,
          network,
          networkStatus: network,
          feeSchedule,
          matchKeys,
          address,
          phone,
          payorId,
          isCustom: true
        });

        await savePayerDirectory(list);
        if (dirAddPayerFormPanel) dirAddPayerFormPanel.style.display = 'none';
        if (dirToggleAddBtn) dirToggleAddBtn.textContent = '+ Add Master Hub / Portal';
        if (dirNewCarrierName) dirNewCarrierName.value = '';
        if (dirNewPayorId) dirNewPayorId.value = '';
        if (dirNewAddress) dirNewAddress.value = '';
        if (dirNewPhone) dirNewPhone.value = '';
        if (dirNewFeeSchedule) dirNewFeeSchedule.value = '';
        if (dirNewMatchKeys) dirNewMatchKeys.value = '';

        renderDedicatedPayerDirectory();
        displayToast(`Added Master Hub ${name} under ${parentCarrier}!`);
      });
    }

    // Bulk Import in Dedicated Modal
    if (dirToggleBulkImportBtn && dirBulkImportPanel) {
      dirToggleBulkImportBtn.addEventListener('click', () => {
        const isHidden = dirBulkImportPanel.style.display === 'none';
        dirBulkImportPanel.style.display = isHidden ? 'block' : 'none';
        if (dirAddPayerFormPanel) dirAddPayerFormPanel.style.display = 'none';
      });
    }

    if (dirCancelBulkImportBtn && dirBulkImportPanel) {
      dirCancelBulkImportBtn.addEventListener('click', () => {
        dirBulkImportPanel.style.display = 'none';
        if (dirBulkImportTextarea) dirBulkImportTextarea.value = '';
      });
    }

    if (dirProcessBulkImportBtn && dirBulkImportTextarea) {
      dirProcessBulkImportBtn.addEventListener('click', async () => {
        const rawText = dirBulkImportTextarea.value.trim();
        if (!rawText) {
          await openCustomNotice('Empty Bulk Import', 'Please paste your insurance carrier/portal list first.');
          return;
        }

        const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return;

        const list = getPayerDirectory();
        let importedCount = 0;

        lines.forEach((line, idx) => {
          let delimiter = '|';
          if (line.includes('\t')) delimiter = '\t';
          else if (line.includes('|')) delimiter = '|';
          else if (line.includes(';') && !line.includes(',')) delimiter = ';';
          else if (line.includes(',')) delimiter = ',';

          const parts = line.split(delimiter).map(p => p.trim());
          if (parts.length === 0 || !parts[0]) return;

          let parentCarrier = 'Standard Carrier';
          let name = parts[0];
          let address = 'N/A';
          let network = 'In-Network';
          let phone = 'N/A';
          let payorId = 'N/A';

          // Check if 6-column format: Parent | Portal | Address | Network | Phone | PayorID
          if (parts.length >= 5 && !/\d{3}/.test(parts[1])) {
            parentCarrier = parts[0];
            name = parts[1];
            address = parts[2] || 'N/A';
            for (let i = 3; i < parts.length; i++) {
              const val = parts[i];
              if (/out/i.test(val)) network = 'Out-of-Network';
              else if (/in/i.test(val)) network = 'In-Network';
              else if (/^[0-9A-Z]{4,8}$/i.test(val) && !val.includes('(')) payorId = val;
              else if (/\d{3}[-.)]\s*\d{3}/.test(val)) phone = val;
            }
          } else {
            name = parts[0];
            parentCarrier = name.toLowerCase().includes('delta') ? 'Delta Dental Ins' : 'Standard Carrier';
            address = parts[1] || 'N/A';
            for (let i = 2; i < parts.length; i++) {
              const val = parts[i];
              if (/out/i.test(val)) network = 'Out-of-Network';
              else if (/in/i.test(val)) network = 'In-Network';
              else if (/^[0-9A-Z]{4,8}$/i.test(val) && !val.includes('(')) payorId = val;
              else if (/\d{3}[-.)]\s*\d{3}/.test(val)) phone = val;
            }
          }

          list.unshift({
            id: 'payer_custom_' + Date.now() + '_' + idx,
            parentCarrier,
            name,
            carrier: name,
            network,
            networkStatus: network,
            feeSchedule: name + ' PPO',
            matchKeys: [name.toLowerCase()],
            address,
            phone,
            payorId,
            isCustom: true
          });
          importedCount++;
        });

        await savePayerDirectory(list);
        dirBulkImportPanel.style.display = 'none';
        dirBulkImportTextarea.value = '';
        renderDedicatedPayerDirectory();
        displayToast(`Imported ${importedCount} carrier hubs into active clinic directory!`);
      });
    }

    if (dirResetDefaultsBtn) {
      dirResetDefaultsBtn.addEventListener('click', async () => {
        const ok = await openCustomConfirm(
          'Reset Insurance Directory',
          'Reset this clinic\'s insurance directory to default Master Hubs (DD Ins Multi-State Hub, DD FEP, DD PPO, MetLife, Cigna, etc.)?',
          'Reset Directory',
          'Cancel'
        );
        if (!ok) return;
        await savePayerDirectory(DEFAULT_PAYER_DIRECTORY.slice());
        renderDedicatedPayerDirectory();
        displayToast('Clinic insurance directory reset to defaults.');
      });
    }

    // ==========================================
    // GATEKEEPER LOGIN, MULTI-CLINIC WORKSPACE & USER ASSIGNMENT
    // ==========================================
    let currentUser = null;
    let cachedPractices = [];
    let cachedUsers = [];

    const gatekeeperScreen = document.getElementById('gatekeeperScreen');
    const appWorkspace = document.getElementById('appWorkspace');
    const gatekeeperForm = document.getElementById('gatekeeperForm');
    const gateEmail = document.getElementById('gateEmail');
    const gatePassword = document.getElementById('gatePassword');
    const gateErrorMsg = document.getElementById('gateErrorMsg');
    const btnGateSubmit = document.getElementById('btnGateSubmit');

    const btnWorkspaceSwitcher = document.getElementById('btnWorkspaceSwitcher');
    const activeWorkspaceLabel = document.getElementById('activeWorkspaceLabel');
    const workspaceChevron = document.getElementById('workspaceChevron');
    const workspaceDropdownPanel = document.getElementById('workspaceDropdownPanel');

    const openClinicManagerBtn = document.getElementById('openClinicManagerBtn');
    const clinicManagerModal = document.getElementById('clinicManagerModal');
    const closeClinicManagerModalBtn = document.getElementById('closeClinicManagerModalBtn');
    const closeClinicManagerFooterBtn = document.getElementById('closeClinicManagerFooterBtn');
    const clinicCountBadge = document.getElementById('clinicCountBadge');
    const userCountBadge = document.getElementById('userCountBadge');
    const paneWorkspaces = document.getElementById('paneWorkspaces');
    const paneStaffUsers = document.getElementById('paneStaffUsers');
    const newClinicNameInput = document.getElementById('newClinicNameInput');
    const btnCreateClinic = document.getElementById('btnCreateClinic');
    const clinicWorkspacesList = document.getElementById('clinicWorkspacesList');

    const toggleAddUserFormBtn = document.getElementById('toggleAddUserFormBtn');
    const addUserFormPanel = document.getElementById('addUserFormPanel');
    const newUserName = document.getElementById('newUserName');
    const newUserEmail = document.getElementById('newUserEmail');
    const newUserPassword = document.getElementById('newUserPassword');
    const newUserRole = document.getElementById('newUserRole');
    const newUserPracticeSelect = document.getElementById('newUserPracticeSelect');
    const cancelAddUserBtn = document.getElementById('cancelAddUserBtn');
    const btnSaveNewUser = document.getElementById('btnSaveNewUser');
    const usersListContainer = document.getElementById('usersListContainer');

    // Dedicated Full-Page Website Owner Settings Dashboard Elements
    const ownerMasterDashboard = document.getElementById('ownerMasterDashboard');
    const clinicVerificationMain = document.getElementById('clinicVerificationMain');
    const ownerPreviewBanner = document.getElementById('ownerPreviewBanner');
    const ownerPreviewClinicName = document.getElementById('ownerPreviewClinicName');
    const btnReturnToOwnerDashboard = document.getElementById('btnReturnToOwnerDashboard');
    const ownerDashClinicCount = document.getElementById('ownerDashClinicCount');
    const ownerDashUserCount = document.getElementById('ownerDashUserCount');
    const ownerDashVerificationCount = document.getElementById('ownerDashVerificationCount');
    const ownerOpenAiSettingsBtn = document.getElementById('ownerOpenAiSettingsBtn');
    const ownerOpenPayerDirBtn = document.getElementById('ownerOpenPayerDirBtn');
    const ownerOpenHistoryBtn = document.getElementById('ownerOpenHistoryBtn');
    const ownerDashNewClinicInput = document.getElementById('ownerDashNewClinicInput');
    const ownerDashCreateClinicBtn = document.getElementById('ownerDashCreateClinicBtn');
    const ownerDashClinicsList = document.getElementById('ownerDashClinicsList');
    const ownerDashToggleAddUserBtn = document.getElementById('ownerDashToggleAddUserBtn');
    const ownerDashAddUserPanel = document.getElementById('ownerDashAddUserPanel');
    const ownerDashNewUserName = document.getElementById('ownerDashNewUserName');
    const ownerDashNewUserEmail = document.getElementById('ownerDashNewUserEmail');
    const ownerDashNewUserPassword = document.getElementById('ownerDashNewUserPassword');
    const ownerDashNewUserRole = document.getElementById('ownerDashNewUserRole');
    const ownerDashNewUserPracticeSelect = document.getElementById('ownerDashNewUserPracticeSelect');
    const ownerDashCancelAddUserBtn = document.getElementById('ownerDashCancelAddUserBtn');
    const ownerDashSaveNewUserBtn = document.getElementById('ownerDashSaveNewUserBtn');
    const ownerDashUsersList = document.getElementById('ownerDashUsersList');

    let ownerPreviewingClinic = false;

    const appBootLoader = document.getElementById('appBootLoader');
    const bootLoaderSubtext = document.getElementById('bootLoaderSubtext');
    const CACHED_USER_KEY = 'dv_cached_user';

    function showBootLoader(message = 'Verifying clinic session & loading workspace...') {
      if (bootLoaderSubtext) bootLoaderSubtext.textContent = message;
      if (appBootLoader) appBootLoader.classList.remove('hidden');
    }

    function hideBootLoader() {
      if (appBootLoader) appBootLoader.classList.add('hidden');
    }

    function formatRoleLabel(role) {
      if (role === 'owner') return 'Website Owner';
      if (role === 'clinic_admin') return 'Clinic Admin';
      return 'Clinic User';
    }

    function applyUserHeaderUI(user) {
      if (gatekeeperScreen) gatekeeperScreen.style.display = 'none';
      if (appWorkspace) appWorkspace.style.display = 'block';

      const roleDisplay = formatRoleLabel(user.role);
      if (userBadgeLabel) userBadgeLabel.textContent = user.full_name || user.email.split('@')[0];
      if (openAuthModalBtn) {
        openAuthModalBtn.classList.add('logged-in');
        openAuthModalBtn.title = `${user.full_name} (${roleDisplay} • ${user.practice_name || 'Clinic'})`;
      }

      const isOwner = user.role === 'owner';
      const isClinicAdmin = user.role === 'clinic_admin';
      const canManageClinic = isOwner || isClinicAdmin;

      // Determine whether Website Owner is on the Full-Page Settings Dashboard or Previewing a Clinic
      const showOwnerMasterScreen = isOwner && !ownerPreviewingClinic;
      if (ownerMasterDashboard) {
        ownerMasterDashboard.style.display = showOwnerMasterScreen ? 'block' : 'none';
      }
      if (clinicVerificationMain) {
        clinicVerificationMain.style.display = showOwnerMasterScreen ? 'none' : 'block';
      }
      if (ownerPreviewBanner) {
        ownerPreviewBanner.style.display = (isOwner && ownerPreviewingClinic) ? 'flex' : 'none';
      }
      if (ownerPreviewClinicName) {
        ownerPreviewClinicName.textContent = user.practice_name || 'Selected Clinic';
      }

      if (activeWorkspaceLabel) {
        activeWorkspaceLabel.textContent = showOwnerMasterScreen
          ? '👑 Website Owner Settings'
          : (user.practice_name || 'Clinic Workspace');
      }

      // Website Owner & Clinic Administrator can access Per-Clinic CDT Checklist & AI Prompt Settings
      if (openSettingsBtn) {
        openSettingsBtn.style.display = canManageClinic ? 'inline-flex' : 'none';
      }

      // Restrict Add / Bulk Import / Reset in Insurance Hub Directory to Clinic Admin & Website Owner
      if (dirToggleAddBtn) dirToggleAddBtn.style.display = canManageClinic ? 'inline-flex' : 'none';
      if (dirToggleBulkImportBtn) dirToggleBulkImportBtn.style.display = canManageClinic ? 'inline-flex' : 'none';
      if (dirResetDefaultsBtn) dirResetDefaultsBtn.style.display = canManageClinic ? 'inline-flex' : 'none';

      // Website Owner & Clinic Administrator can open Clinic/User Management Modal
      if (openClinicManagerBtn) {
        openClinicManagerBtn.style.display = canManageClinic ? 'inline-flex' : 'none';
        const btnLabel = document.getElementById('openClinicManagerLabel');
        if (btnLabel) {
          btnLabel.textContent = isOwner ? 'Owner Settings Home' : 'Manage Clinic Users';
        }
      }

      if (workspaceChevron) {
        workspaceChevron.style.display = isOwner ? 'inline-block' : 'none';
      }
      if (btnWorkspaceSwitcher) {
        btnWorkspaceSwitcher.style.cursor = isOwner ? 'pointer' : 'default';
        btnWorkspaceSwitcher.title = isOwner
          ? 'Switch between Website Owner Settings Dashboard and Previewing a Clinic'
          : `Assigned Workspace: ${user.practice_name}`;
      }

      if (authLoggedInView) authLoggedInView.style.display = 'block';
      if (authLoginForm) authLoginForm.style.display = 'none';
      if (authSessionUserName) authSessionUserName.textContent = `${user.full_name || 'Clinic User'} (${roleDisplay})`;
      if (authSessionUserEmail) authSessionUserEmail.textContent = user.email;
      if (authSessionPracticeName) authSessionPracticeName.textContent = `Active Workspace: ${user.practice_name || 'Website Owner (Master Admin)'}`;
    }

    async function checkUserAuth() {
      showBootLoader('Verifying clinic session & loading workspace...');
      // Instantly restore workspace UI behind the spinner if user session is cached locally
      try {
        const cachedRaw = localStorage.getItem(CACHED_USER_KEY);
        if (cachedRaw) {
          const cachedUser = JSON.parse(cachedRaw);
          if (cachedUser && cachedUser.email) {
            currentUser = cachedUser;
            ownerPreviewingClinic = Boolean(cachedUser.role === 'owner' && cachedUser.practice_id);
            applyUserHeaderUI(cachedUser);
          }
        }
      } catch (e) {}

      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            await setCurrentUser(data.user);
            hideBootLoader();
            return;
          }
        }
      } catch (err) {
        console.warn('Auth check skipped:', err);
      }
      await setCurrentUser(null);
      hideBootLoader();
    }

    async function setCurrentUser(user) {
      currentUser = user;
      if (user) {
        // When Website Owner logs in with no assigned clinic, open Master Settings Dashboard directly
        ownerPreviewingClinic = Boolean(user.role === 'owner' && user.practice_id);
        try {
          localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
          localStorage.removeItem(HISTORY_STORAGE_KEY);
        } catch (e) {}
        applyUserHeaderUI(user);

        // Load isolated clinic data & per-clinic CDT checklist/prompt
        await loadClinicPayersFromServer();
        await loadPromptSettings();
        await syncHistoryFromBackend();
        renderHistoryList();
        if (user.role === 'owner' || user.role === 'clinic_admin') {
          await loadOwnerClinicsAndUsers();
        }
      } else {
        ownerPreviewingClinic = false;
        try {
          localStorage.removeItem(CACHED_USER_KEY);
          localStorage.removeItem(HISTORY_STORAGE_KEY);
          localStorage.removeItem(PAYER_DIRECTORY_STORAGE_KEY);
        } catch (e) {}
        cachedServerHistory = [];
        cachedPractices = [];
        cachedUsers = [];
        resetVerificationState();
        updateHistoryCountUI();
        // Lock Workspace, Show Gatekeeper Login Screen
        if (appWorkspace) appWorkspace.style.display = 'none';
        if (gatekeeperScreen) gatekeeperScreen.style.display = 'flex';
        if (workspaceDropdownPanel) workspaceDropdownPanel.style.display = 'none';

        if (userBadgeLabel) userBadgeLabel.textContent = 'Sign In';
        if (openAuthModalBtn) {
          openAuthModalBtn.classList.remove('logged-in');
        }
        if (authLoggedInView) authLoggedInView.style.display = 'none';
        if (authLoginForm) authLoginForm.style.display = 'block';
      }
    }

    // Gatekeeper Login Form Handler
    if (gatekeeperForm) {
      gatekeeperForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (gateErrorMsg) gateErrorMsg.style.display = 'none';
        if (btnGateSubmit) {
          btnGateSubmit.disabled = true;
          btnGateSubmit.innerHTML = '<span>Unlocking Clinic Workspace...</span>';
        }

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: gateEmail.value.trim(),
              password: gatePassword.value,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success && data.user) {
            gatePassword.value = '';
            await setCurrentUser(data.user);
            resetInactivityTimer();
            if (data.user.role === 'owner') {
              displayToast(`Welcome Website Owner! Global Settings & Multi-Clinic Dashboard loaded.`);
            } else if (data.user.role === 'clinic_admin') {
              displayToast(`Welcome Clinic Admin (${data.user.practice_name})! You can manage your clinic's users and settings.`);
            } else {
              displayToast(`Unlocked ${data.user.practice_name || 'Clinic Workspace'} — Welcome, ${data.user.full_name}!`);
            }
          } else {
            if (gateErrorMsg) {
              gateErrorMsg.textContent = data.error || 'Invalid clinic email or password.';
              gateErrorMsg.style.display = 'block';
            }
          }
        } catch (err) {
          if (gateErrorMsg) {
            gateErrorMsg.textContent = 'Server connection error. Please try again.';
            gateErrorMsg.style.display = 'block';
          }
        } finally {
          if (btnGateSubmit) {
            btnGateSubmit.disabled = false;
            btnGateSubmit.innerHTML = `
              <span>Sign In to Clinic Workspace</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            `;
          }
        }
      });
    }

    // Owner & Clinic Admin Workspace & User Management Functions
    async function loadOwnerClinicsAndUsers() {
      if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'clinic_admin')) return;
      try {
        const [pracRes, usrRes] = await Promise.all([
          fetch('/api/practices'),
          fetch('/api/users')
        ]);
        if (pracRes.ok) {
          const pData = await pracRes.json();
          if (pData.success) cachedPractices = pData.practices || [];
        }
        if (usrRes.ok) {
          const uData = await usrRes.json();
          if (uData.success) cachedUsers = uData.users || [];
        }
        if (currentUser.role === 'owner') {
          renderWorkspaceSwitcherDropdown();
        }
        renderClinicManagerModalContent();
      } catch (e) {
        console.warn('Could not load clinics/users:', e);
      }
    }

    function renderWorkspaceSwitcherDropdown() {
      if (!workspaceDropdownPanel || !currentUser || currentUser.role !== 'owner') return;
      workspaceDropdownPanel.innerHTML = `
        <div style="font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: #64748b; padding: 0.25rem 0.6rem; letter-spacing: 0.05em;">
          Website Owner Mode / Preview Clinic
        </div>
      `;

      // Top option: Master Owner Mode (Dedicated Full-Page Settings Dashboard)
      const isMaster = !ownerPreviewingClinic;
      const masterBtn = document.createElement('button');
      masterBtn.type = 'button';
      masterBtn.className = `workspace-item-btn ${isMaster ? 'active' : ''}`;
      masterBtn.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span>👑 Website Owner Settings Dashboard</span>
          <span style="font-size: 0.65rem; color: #fbbf24; font-weight: 400;">Manage All Clinics, Users, AI & Payers</span>
        </div>
        ${isMaster ? '<span style="color: #34d399; font-weight: 800;">✓</span>' : ''}
      `;
      masterBtn.addEventListener('click', async () => {
        workspaceDropdownPanel.style.display = 'none';
        await switchActiveClinicWorkspace('none', { enterPreview: false });
      });
      workspaceDropdownPanel.appendChild(masterBtn);

      cachedPractices.forEach(prac => {
        const isCurrent = ownerPreviewingClinic && prac.id === currentUser.practice_id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `workspace-item-btn ${isCurrent ? 'active' : ''}`;
        btn.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span>👁️ Preview: ${escapeHtml(prac.name)}</span>
            <span style="font-size: 0.65rem; color: #94a3b8; font-weight: 400;">${prac.verification_count || 0} breakdowns • ${prac.user_count || 0} clinic accounts</span>
          </div>
          ${isCurrent ? '<span style="color: #34d399; font-weight: 800;">✓</span>' : ''}
        `;
        btn.addEventListener('click', async () => {
          workspaceDropdownPanel.style.display = 'none';
          await switchActiveClinicWorkspace(prac.id, { enterPreview: true });
        });
        workspaceDropdownPanel.appendChild(btn);
      });
    }

    async function switchActiveClinicWorkspace(practiceId, options = {}) {
      const enterPreview = options.enterPreview !== undefined
        ? Boolean(options.enterPreview)
        : (practiceId !== 'none');
      try {
        const res = await fetch(`/api/practices/switch/${practiceId}`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
          currentUser.practice_id = data.practice_id;
          currentUser.practice_name = data.practice_name;
          if (currentUser.role === 'owner') {
            ownerPreviewingClinic = enterPreview && Boolean(data.practice_id);
          }
          try {
            localStorage.setItem(CACHED_USER_KEY, JSON.stringify(currentUser));
          } catch (e) {}
          applyUserHeaderUI(currentUser);

          // Reload isolated clinic data & per-clinic CDT checklist/prompt
          await loadClinicPayersFromServer();
          await loadPromptSettings();
          await syncHistoryFromBackend();
          renderHistoryList();
          renderWorkspaceSwitcherDropdown();
          renderClinicManagerModalContent();
          displayToast(
            ownerPreviewingClinic
              ? `Previewing Clinic Workspace: ${data.practice_name}`
              : `Active context: ${data.practice_name}`
          );
        } else {
          displayToast(data.error || 'Failed to switch clinic workspace.');
        }
      } catch (e) {
        displayToast('Error switching workspace.');
      }
    }

    if (btnReturnToOwnerDashboard) {
      btnReturnToOwnerDashboard.addEventListener('click', async () => {
        await switchActiveClinicWorkspace('none', { enterPreview: false });
      });
    }

    if (ownerOpenAiSettingsBtn) {
      ownerOpenAiSettingsBtn.addEventListener('click', () => {
        if (openSettingsBtn) openSettingsBtn.click();
      });
    }

    if (ownerOpenPayerDirBtn) {
      ownerOpenPayerDirBtn.addEventListener('click', () => {
        openInsuranceDirectory();
      });
    }

    if (ownerOpenHistoryBtn) {
      ownerOpenHistoryBtn.addEventListener('click', () => {
        if (openHistoryBtn) openHistoryBtn.click();
      });
    }

    if (btnWorkspaceSwitcher) {
      btnWorkspaceSwitcher.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!currentUser || currentUser.role !== 'owner') return;
        const isHidden = workspaceDropdownPanel.style.display === 'none';
        if (isHidden) {
          loadOwnerClinicsAndUsers();
          workspaceDropdownPanel.style.display = 'flex';
        } else {
          workspaceDropdownPanel.style.display = 'none';
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (workspaceDropdownPanel && workspaceDropdownPanel.style.display !== 'none') {
        if (!workspaceDropdownPanel.contains(e.target) && e.target !== btnWorkspaceSwitcher) {
          workspaceDropdownPanel.style.display = 'none';
        }
      }
    });

    // Clinic & User Management Modal + Full-Page Grouped Owner Dashboard Rendering
    function renderClinicManagerModalContent() {
      const isOwner = currentUser && currentUser.role === 'owner';
      const modalTitleEl = document.getElementById('clinicManagerModalTitle');
      if (modalTitleEl) {
        modalTitleEl.textContent = isOwner
          ? 'Website Owner Control — Clinics, Administrators & Users'
          : `Clinic Administrator (${currentUser?.practice_name || 'Clinic'}) — Manage Clinic & Users`;
      }

      const addClinicFormRow = document.getElementById('addClinicFormRow');
      if (addClinicFormRow) {
        addClinicFormRow.style.display = isOwner ? 'flex' : 'none';
      }

      const ownerRoleOpt = document.getElementById('newUserRoleOwnerOption');
      if (ownerRoleOpt) {
        ownerRoleOpt.style.display = isOwner ? 'block' : 'none';
      }

      const staffOnlyCount = cachedUsers.filter(u => u.role !== 'owner').length;
      const totalVerifications = cachedPractices.reduce((sum, p) => sum + (Number(p.verification_count) || 0), 0);

      if (clinicCountBadge) clinicCountBadge.textContent = cachedPractices.length;
      if (userCountBadge) userCountBadge.textContent = staffOnlyCount;
      if (ownerDashClinicCount) ownerDashClinicCount.textContent = cachedPractices.length;
      if (ownerDashUserCount) ownerDashUserCount.textContent = staffOnlyCount;
      if (ownerDashVerificationCount) ownerDashVerificationCount.textContent = totalVerifications;

      // Populate Practice Select in Add User Forms (Modal & Owner Dashboard)
      const practiceOptsHtml = cachedPractices.map(p =>
        `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`
      ).join('');
      if (newUserPracticeSelect) {
        newUserPracticeSelect.innerHTML = practiceOptsHtml;
        newUserPracticeSelect.disabled = !isOwner;
      }
      if (ownerDashNewUserPracticeSelect) {
        ownerDashNewUserPracticeSelect.innerHTML = practiceOptsHtml;
      }

      // Reusable Helper: Create a Clean Read-Only User Row with an On-Demand "✏️ Edit" Drawer
      const createCleanUserRowElement = (u) => {
        const isOwnerAccount = u.role === 'owner';
        const isClinicAdminAccount = u.role === 'clinic_admin';
        const badgeClass = isOwnerAccount ? 'owner' : (isClinicAdminAccount ? 'clinic_admin' : 'staff');
        const badgeLabel = isOwnerAccount ? 'WEBSITE OWNER' : (isClinicAdminAccount ? 'CLINIC ADMIN' : 'USER / STAFF');

        const initials = String(u.full_name || u.email || 'U')
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map(w => w[0]?.toUpperCase() || '')
          .join('') || 'U';

        const avatarBg = isOwnerAccount
          ? 'background: rgba(251, 191, 36, 0.16); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.4);'
          : (isClinicAdminAccount
              ? 'background: rgba(56, 189, 248, 0.16); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4);'
              : 'background: rgba(16, 185, 129, 0.14); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35);');

        const practiceOptions = cachedPractices.map(p =>
          `<option value="${escapeHtml(p.id)}" ${p.id === u.practice_id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
        ).join('');

        const rowWrap = document.createElement('div');
        rowWrap.style.cssText = 'background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(148, 163, 184, 0.14); border-radius: 8px; padding: 0.55rem 0.75rem; transition: border-color 0.15s ease;';

        rowWrap.innerHTML = `
          <!-- Clean 1-Line Read-Only Summary Row -->
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 200px; flex: 1;">
              <div style="width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800; flex-shrink: 0; ${avatarBg}">
                ${escapeHtml(initials)}
              </div>
              <div style="display: flex; flex-direction: column; line-height: 1.25;">
                <span style="font-size: 0.82rem; font-weight: 700; color: #f8fafc;">${escapeHtml(u.full_name || 'User')}</span>
                <span style="font-size: 0.72rem; color: #94a3b8; font-family: var(--font-mono);">${escapeHtml(u.email)}</span>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
              <span class="user-role-badge ${badgeClass}" style="font-size: 0.64rem; padding: 0.18rem 0.5rem;">${badgeLabel}</span>
              <button type="button" class="btn-action-ghost btn-toggle-user-edit" style="padding: 0.24rem 0.58rem; font-size: 0.69rem;" title="Edit account details, role, clinic, or password">
                ✏️ Edit
              </button>
              ${!isOwnerAccount && u.id !== currentUser?.id ? `
                <button type="button" class="del-payer-btn btn-del-user" title="Delete account" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px 5px; font-size: 0.78rem;">✕</button>
              ` : ''}
            </div>
          </div>

          <!-- Hidden On-Demand Edit Drawer (Opens only when "✏️ Edit" is clicked) -->
          <div class="user-edit-drawer" style="display: none; margin-top: 0.65rem; padding-top: 0.65rem; border-top: 1px dashed rgba(56, 189, 248, 0.3);">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); gap: 0.5rem; margin-bottom: 0.55rem;">
              <div>
                <label style="display: block; font-size: 0.65rem; color: #94a3b8; margin-bottom: 0.18rem;">Full Name</label>
                <input type="text" class="table-search-input user-edit-name" value="${escapeHtml(u.full_name)}" style="padding: 0.3rem 0.55rem; font-size: 0.75rem; color: #fff;">
              </div>
              <div>
                <label style="display: block; font-size: 0.65rem; color: #94a3b8; margin-bottom: 0.18rem;">Login Email</label>
                <input type="email" class="table-search-input user-edit-email" value="${escapeHtml(u.email)}" style="padding: 0.3rem 0.55rem; font-size: 0.75rem; color: #38bdf8;">
              </div>
              ${!isOwnerAccount ? `
                <div>
                  <label style="display: block; font-size: 0.65rem; color: #94a3b8; margin-bottom: 0.18rem;">Clinic Role</label>
                  <select class="table-search-input user-role-select" style="background: #0f172a; color: #f8fafc; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 6px; padding: 0.3rem 0.5rem; font-size: 0.74rem; width: 100%;">
                    <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Clinic User (Staff)</option>
                    <option value="clinic_admin" ${u.role === 'clinic_admin' ? 'selected' : ''}>Clinic Admin</option>
                  </select>
                </div>
              ` : ''}
              ${!isOwnerAccount && isOwner ? `
                <div>
                  <label style="display: block; font-size: 0.65rem; color: #94a3b8; margin-bottom: 0.18rem;">Assigned Clinic</label>
                  <select class="table-search-input user-clinic-select" style="background: #0f172a; color: #f8fafc; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 6px; padding: 0.3rem 0.5rem; font-size: 0.74rem; width: 100%;">
                    ${practiceOptions}
                  </select>
                </div>
              ` : ''}
              <div>
                <label style="display: block; font-size: 0.65rem; color: #94a3b8; margin-bottom: 0.18rem;">New Password (Optional)</label>
                <input type="password" class="table-search-input user-new-pw-input" placeholder="Leave blank to keep current" style="padding: 0.3rem 0.55rem; font-size: 0.74rem; color: #fff;">
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.45rem;">
              <button type="button" class="btn-restore-defaults btn-cancel-user-edit" style="padding: 0.25rem 0.65rem; font-size: 0.7rem;">Cancel</button>
              <button type="button" class="btn-verify-primary btn-save-user-info" style="padding: 0.25rem 0.75rem; font-size: 0.7rem;">💾 Save Changes</button>
            </div>
          </div>
        `;

        const toggleEditBtn = rowWrap.querySelector('.btn-toggle-user-edit');
        const cancelEditBtn = rowWrap.querySelector('.btn-cancel-user-edit');
        const editDrawer = rowWrap.querySelector('.user-edit-drawer');
        const saveUserBtn = rowWrap.querySelector('.btn-save-user-info');
        const nameInput = rowWrap.querySelector('.user-edit-name');
        const emailInput = rowWrap.querySelector('.user-edit-email');
        const roleSelect = rowWrap.querySelector('.user-role-select');
        const clinicSelect = rowWrap.querySelector('.user-clinic-select');
        const pwInput = rowWrap.querySelector('.user-new-pw-input');
        const delBtn = rowWrap.querySelector('.btn-del-user');

        if (toggleEditBtn && editDrawer) {
          toggleEditBtn.addEventListener('click', () => {
            const isHidden = editDrawer.style.display === 'none';
            editDrawer.style.display = isHidden ? 'block' : 'none';
            toggleEditBtn.textContent = isHidden ? '✕ Close' : '✏️ Edit';
            rowWrap.style.borderColor = isHidden ? 'rgba(56, 189, 248, 0.45)' : 'rgba(148, 163, 184, 0.14)';
          });
        }

        if (cancelEditBtn && editDrawer && toggleEditBtn) {
          cancelEditBtn.addEventListener('click', () => {
            editDrawer.style.display = 'none';
            toggleEditBtn.textContent = '✏️ Edit';
            rowWrap.style.borderColor = 'rgba(148, 163, 184, 0.14)';
            if (pwInput) pwInput.value = '';
          });
        }

        if (saveUserBtn && nameInput && emailInput) {
          saveUserBtn.addEventListener('click', async () => {
            const newFullName = nameInput.value.trim();
            const newEmail = emailInput.value.trim().toLowerCase().replace(/@+/g, '@');
            emailInput.value = newEmail;
            if (!newFullName || !newEmail) {
              await openCustomNotice('Validation Notice', 'Name and Email cannot be empty.');
              return;
            }
            const payload = { full_name: newFullName, email: newEmail };
            if (roleSelect && roleSelect.value) {
              payload.role = roleSelect.value;
            }
            if (clinicSelect && clinicSelect.value) {
              payload.practice_id = clinicSelect.value;
            }
            if (pwInput && pwInput.value.trim()) {
              if (pwInput.value.trim().length < 8) {
                await openCustomNotice('Password Too Short', 'Password must be at least 8 characters.');
                return;
              }
              payload.password = pwInput.value.trim();
            }
            const res = await fetch(`/api/users/${u.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.success) {
              if (currentUser && currentUser.id === u.id) {
                currentUser.full_name = newFullName;
                currentUser.email = newEmail;
                applyUserHeaderUI(currentUser);
                try { localStorage.setItem(CACHED_USER_KEY, JSON.stringify(currentUser)); } catch (e) {}
              }
              await loadOwnerClinicsAndUsers();
              displayToast(`Saved changes for ${newFullName}!`);
            } else {
              await openCustomNotice('Update Failed', data.error || 'Failed to update user.');
            }
          });
        }

        if (delBtn) {
          delBtn.addEventListener('click', async () => {
            const ok = await openCustomConfirm(
              'Delete User Account',
              `Delete user account "${u.full_name}" (${u.email})?`,
              'Delete Account',
              'Cancel'
            );
            if (!ok) return;
            const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
            if (res.ok) {
              await loadOwnerClinicsAndUsers();
              displayToast(`Deleted user ${u.email}.`);
            }
          });
        }

        return rowWrap;
      };

      // 1. Render Website Owner Profile Strip at top of Owner Dashboard
      const ownerProfileCardContainer = document.getElementById('ownerProfileCardContainer');
      if (ownerProfileCardContainer) {
        ownerProfileCardContainer.innerHTML = '';
        const ownerAccounts = cachedUsers.filter(u => u.role === 'owner');
        ownerAccounts.forEach(ownerAcc => {
          ownerProfileCardContainer.appendChild(createCleanUserRowElement(ownerAcc));
        });
      }

      // 2. Render Grouped Clinic Cards on Owner Dashboard (Each Clinic Card contains its own Admin & Staff rows)
      if (ownerDashClinicsList) {
        ownerDashClinicsList.innerHTML = '';
        cachedPractices.forEach(prac => {
          const isCurrent = currentUser && prac.id === currentUser.practice_id;
          const clinicMembers = cachedUsers
            .filter(u => u.practice_id === prac.id && u.role !== 'owner')
            .sort((a, b) => {
              if (a.role === 'clinic_admin' && b.role !== 'clinic_admin') return -1;
              if (a.role !== 'clinic_admin' && b.role === 'clinic_admin') return 1;
              return String(a.full_name || '').localeCompare(String(b.full_name || ''));
            });

          const card = document.createElement('div');
          card.style.cssText = `background: rgba(15, 23, 42, 0.78); border: 1px solid ${isCurrent ? 'rgba(56, 189, 248, 0.55)' : 'rgba(56, 189, 248, 0.22)'}; border-radius: 12px; padding: 1.05rem 1.15rem; display: flex; flex-direction: column; gap: 0.75rem;`;

          card.innerHTML = `
            <!-- Clinic Card Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; flex-wrap: wrap; padding-bottom: 0.65rem; border-bottom: 1px solid rgba(148, 163, 184, 0.14);">
              <div>
                <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                  <span style="font-size: 1rem; font-weight: 800; color: #fff;">🏥 ${escapeHtml(prac.name)}</span>
                  <button type="button" class="btn-action-ghost btn-toggle-clinic-rename" style="padding: 0.15rem 0.45rem; font-size: 0.65rem;" title="Rename this clinic">✏️ Rename</button>
                  ${isCurrent ? '<span class="user-role-badge staff" style="font-size: 0.62rem;">Active Context</span>' : ''}
                </div>
                <div class="clinic-mgmt-stats" style="margin-top: 0.25rem;">
                  <span>📋 ${prac.verification_count || 0} Patient Breakdowns</span>
                  <span>•</span>
                  <span>👥 ${clinicMembers.length} Assigned Accounts</span>
                </div>
              </div>

              <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
                <button type="button" class="btn-action-ghost btn-add-user-here" style="padding: 0.28rem 0.58rem; font-size: 0.69rem; border-color: rgba(16, 185, 129, 0.4); color: #34d399;" title="Add a user or admin to ${escapeHtml(prac.name)}">+ User</button>
                <button type="button" class="btn-action-ghost btn-edit-clinic-payers" style="padding: 0.28rem 0.58rem; font-size: 0.69rem;" title="Edit ${escapeHtml(prac.name)}'s Insurance Hub Directory">🏥 Payers</button>
                <button type="button" class="btn-action-ghost btn-edit-clinic-ai" style="padding: 0.28rem 0.58rem; font-size: 0.69rem;" title="Edit ${escapeHtml(prac.name)}'s CDT Checklist & AI Prompt">⚙️ CDT & AI</button>
                <button type="button" class="btn-verify-primary btn-switch-here" style="padding: 0.28rem 0.65rem; font-size: 0.69rem;" title="Preview ${escapeHtml(prac.name)}'s upload workspace">👁️ Preview</button>
                <button type="button" class="del-payer-btn btn-del-clinic" title="Delete clinic workspace" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px 5px; font-size: 0.8rem;">✕</button>
              </div>
            </div>

            <!-- Hidden Clinic Rename Drawer -->
            <div class="clinic-rename-drawer" style="display: none; align-items: center; gap: 0.45rem; background: rgba(15, 23, 42, 0.9); padding: 0.5rem 0.65rem; border-radius: 8px; border: 1px dashed rgba(56, 189, 248, 0.35);">
              <input type="text" class="table-search-input clinic-rename-input" value="${escapeHtml(prac.name)}" style="flex: 1; padding: 0.28rem 0.55rem; font-size: 0.78rem; color: #fff; font-weight: 700;">
              <button type="button" class="btn-verify-primary btn-save-clinic-name" style="padding: 0.28rem 0.65rem; font-size: 0.7rem;">💾 Save Name</button>
              <button type="button" class="btn-restore-defaults btn-cancel-clinic-rename" style="padding: 0.28rem 0.55rem; font-size: 0.7rem;">Cancel</button>
            </div>

            <!-- Clinic Team Members List -->
            <div class="clinic-members-container" style="display: flex; flex-direction: column; gap: 0.45rem;"></div>
          `;

          const toggleRenameBtn = card.querySelector('.btn-toggle-clinic-rename');
          const renameDrawer = card.querySelector('.clinic-rename-drawer');
          const renameInput = card.querySelector('.clinic-rename-input');
          const saveNameBtn = card.querySelector('.btn-save-clinic-name');
          const cancelRenameBtn = card.querySelector('.btn-cancel-clinic-rename');

          if (toggleRenameBtn && renameDrawer) {
            toggleRenameBtn.addEventListener('click', () => {
              const isHidden = renameDrawer.style.display === 'none';
              renameDrawer.style.display = isHidden ? 'flex' : 'none';
              if (isHidden && renameInput) renameInput.focus();
            });
          }

          if (cancelRenameBtn && renameDrawer) {
            cancelRenameBtn.addEventListener('click', () => {
              renameDrawer.style.display = 'none';
              if (renameInput) renameInput.value = prac.name;
            });
          }

          if (saveNameBtn && renameInput) {
            saveNameBtn.addEventListener('click', async () => {
              const newName = renameInput.value.trim();
              if (!newName) return;
              const res = await fetch(`/api/practices/${prac.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
              });
              if (res.ok) {
                if (currentUser && currentUser.practice_id === prac.id) {
                  currentUser.practice_name = newName;
                  applyUserHeaderUI(currentUser);
                  try { localStorage.setItem(CACHED_USER_KEY, JSON.stringify(currentUser)); } catch (e) {}
                }
                await loadOwnerClinicsAndUsers();
                displayToast(`Renamed clinic to "${newName}"`);
              }
            });
          }

          const addUserHereBtn = card.querySelector('.btn-add-user-here');
          if (addUserHereBtn && ownerDashAddUserPanel) {
            addUserHereBtn.addEventListener('click', () => {
              ownerDashAddUserPanel.style.display = 'block';
              if (ownerDashNewUserPracticeSelect) ownerDashNewUserPracticeSelect.value = prac.id;
              if (ownerDashNewUserName) ownerDashNewUserName.focus();
            });
          }

          const editPayersBtn = card.querySelector('.btn-edit-clinic-payers');
          if (editPayersBtn) {
            editPayersBtn.addEventListener('click', async () => {
              if (!isCurrent) {
                await switchActiveClinicWorkspace(prac.id, { enterPreview: ownerPreviewingClinic });
              }
              openInsuranceDirectory();
            });
          }

          const editAiBtn = card.querySelector('.btn-edit-clinic-ai');
          if (editAiBtn) {
            editAiBtn.addEventListener('click', async () => {
              if (!isCurrent) {
                await switchActiveClinicWorkspace(prac.id, { enterPreview: ownerPreviewingClinic });
              }
              if (openSettingsBtn) openSettingsBtn.click();
            });
          }

          const switchBtn = card.querySelector('.btn-switch-here');
          if (switchBtn) {
            switchBtn.addEventListener('click', async () => {
              await switchActiveClinicWorkspace(prac.id, { enterPreview: true });
            });
          }

          const delClinicBtn = card.querySelector('.btn-del-clinic');
          if (delClinicBtn) {
            delClinicBtn.addEventListener('click', async () => {
              const ok = await openCustomConfirm(
                'Delete Clinic Workspace',
                `Delete clinic workspace "${prac.name}" and its records?`,
                'Delete Clinic',
                'Cancel'
              );
              if (!ok) return;
              const res = await fetch(`/api/practices/${prac.id}`, { method: 'DELETE' });
              if (res.ok) {
                if (currentUser && currentUser.practice_id === prac.id) {
                  await switchActiveClinicWorkspace('none', { enterPreview: false });
                }
                await loadOwnerClinicsAndUsers();
                displayToast(`Deleted clinic workspace "${prac.name}".`);
              }
            });
          }

          const membersContainer = card.querySelector('.clinic-members-container');
          if (membersContainer) {
            if (clinicMembers.length === 0) {
              membersContainer.innerHTML = `
                <div style="font-size: 0.74rem; color: #64748b; padding: 0.45rem 0.6rem; background: rgba(15, 23, 42, 0.45); border-radius: 6px; text-align: center;">
                  No Clinic Admin or Staff assigned yet. Click <strong>+ User</strong> above to assign an account.
                </div>
              `;
            } else {
              clinicMembers.forEach(member => {
                membersContainer.appendChild(createCleanUserRowElement(member));
              });
            }
          }

          ownerDashClinicsList.appendChild(card);
        });
      }

      // 3. Also populate the Clinic Manager Modal (for Clinic Admins managing their own clinic)
      if (clinicWorkspacesList) {
        clinicWorkspacesList.innerHTML = '';
        cachedPractices.forEach(prac => {
          const card = document.createElement('div');
          card.className = 'clinic-mgmt-card';
          card.style.flexWrap = 'wrap';
          card.innerHTML = `
            <div style="flex: 1; min-width: 220px;">
              <div class="clinic-mgmt-title" style="flex-wrap: wrap;">
                <input type="text" class="table-search-input clinic-rename-input" value="${escapeHtml(prac.name)}" style="font-weight: 700; color: #fff; max-width: 260px; padding: 0.28rem 0.55rem; font-size: 0.8rem;">
              </div>
              <div class="clinic-mgmt-stats">
                <span>📋 ${prac.verification_count || 0} Patient Breakdowns</span>
                <span>•</span>
                <span>👥 ${prac.user_count || 0} Clinic Accounts</span>
              </div>
            </div>
            <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
              <button type="button" class="btn-action-ghost btn-save-clinic-name" style="padding: 0.3rem 0.55rem; font-size: 0.69rem;">💾 Save Name</button>
              <button type="button" class="btn-action-ghost btn-edit-clinic-payers" style="padding: 0.3rem 0.55rem; font-size: 0.69rem;">🏥 Payer Hubs</button>
              <button type="button" class="btn-action-ghost btn-edit-clinic-ai" style="padding: 0.3rem 0.55rem; font-size: 0.69rem;">⚙️ CDT & AI</button>
            </div>
          `;
          const renameInput = card.querySelector('.clinic-rename-input');
          const saveNameBtn = card.querySelector('.btn-save-clinic-name');
          saveNameBtn.addEventListener('click', async () => {
            const newName = renameInput.value.trim();
            if (!newName) return;
            const res = await fetch(`/api/practices/${prac.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: newName })
            });
            if (res.ok) {
              await loadOwnerClinicsAndUsers();
              displayToast(`Renamed clinic to "${newName}"`);
            }
          });
          card.querySelector('.btn-edit-clinic-payers')?.addEventListener('click', () => {
            if (clinicManagerModal) clinicManagerModal.classList.remove('active');
            openInsuranceDirectory();
          });
          card.querySelector('.btn-edit-clinic-ai')?.addEventListener('click', () => {
            if (clinicManagerModal) clinicManagerModal.classList.remove('active');
            if (openSettingsBtn) openSettingsBtn.click();
          });
          clinicWorkspacesList.appendChild(card);
        });
      }

      if (usersListContainer) {
        usersListContainer.innerHTML = '';
        cachedUsers.forEach(u => {
          usersListContainer.appendChild(createCleanUserRowElement(u));
        });
      }
    }

    if (openClinicManagerBtn) {
      openClinicManagerBtn.addEventListener('click', async () => {
        await loadOwnerClinicsAndUsers();
        if (currentUser && currentUser.role === 'owner') {
          if (ownerPreviewingClinic) {
            await switchActiveClinicWorkspace('none', { enterPreview: false });
          } else {
            applyUserHeaderUI(currentUser);
            displayToast('Website Owner Settings Dashboard active.');
          }
          return;
        }
        if (clinicManagerModal) clinicManagerModal.classList.add('active');
      });
    }

    if (closeClinicManagerModalBtn) {
      closeClinicManagerModalBtn.addEventListener('click', () => {
        if (clinicManagerModal) clinicManagerModal.classList.remove('active');
      });
    }

    if (closeClinicManagerFooterBtn) {
      closeClinicManagerFooterBtn.addEventListener('click', () => {
        if (clinicManagerModal) clinicManagerModal.classList.remove('active');
      });
    }

    if (clinicManagerModal) {
      clinicManagerModal.addEventListener('click', (e) => {
        if (e.target === clinicManagerModal) {
          clinicManagerModal.classList.remove('active');
        }
      });
    }

    // Tab switching in Clinic Manager Modal
    document.querySelectorAll('[data-mgmt-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-mgmt-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.mgmtTab;
        if (paneWorkspaces) paneWorkspaces.style.display = target === 'tabWorkspaces' ? 'block' : 'none';
        if (paneStaffUsers) paneStaffUsers.style.display = target === 'tabStaffUsers' ? 'block' : 'none';
      });
    });

    // Create New Clinic (Modal & Owner Dashboard)
    const handleCreateNewClinic = async (inputEl) => {
      const name = inputEl?.value.trim();
      if (!name) {
        await openCustomNotice('Clinic Name Required', 'Please enter a clinic workspace name.');
        return;
      }
      const res = await fetch('/api/practices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        inputEl.value = '';
        await loadOwnerClinicsAndUsers();
        displayToast(`Created clinic workspace: ${name}`);
      }
    };

    if (btnCreateClinic && newClinicNameInput) {
      btnCreateClinic.addEventListener('click', () => handleCreateNewClinic(newClinicNameInput));
    }
    if (ownerDashCreateClinicBtn && ownerDashNewClinicInput) {
      ownerDashCreateClinicBtn.addEventListener('click', () => handleCreateNewClinic(ownerDashNewClinicInput));
    }

    // Create & Assign New User (Modal)
    if (toggleAddUserFormBtn && addUserFormPanel) {
      toggleAddUserFormBtn.addEventListener('click', () => {
        const isHidden = addUserFormPanel.style.display === 'none';
        addUserFormPanel.style.display = isHidden ? 'block' : 'none';
      });
    }

    if (cancelAddUserBtn && addUserFormPanel) {
      cancelAddUserBtn.addEventListener('click', () => {
        addUserFormPanel.style.display = 'none';
      });
    }

    if (btnSaveNewUser) {
      btnSaveNewUser.addEventListener('click', async () => {
        const full_name = newUserName?.value.trim();
        const email = newUserEmail?.value.trim();
        const password = newUserPassword?.value;
        const role = newUserRole?.value || 'staff';
        const practice_id = newUserPracticeSelect?.value;

        if (!full_name || !email || !password || (role !== 'owner' && !practice_id)) {
          await openCustomNotice('Missing Fields', 'Please fill in Full Name, Email, Password, and Assigned Clinic.');
          return;
        }

        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name, email, password, role, practice_id })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (newUserName) newUserName.value = '';
          if (newUserEmail) newUserEmail.value = '';
          if (newUserPassword) newUserPassword.value = '';
          if (addUserFormPanel) addUserFormPanel.style.display = 'none';
          await loadOwnerClinicsAndUsers();
          displayToast(`Created & assigned user: ${email}`);
        } else {
          await openCustomNotice('Could Not Create User', data.error || 'Could not create user.');
        }
      });
    }

    // Create & Assign New User (Owner Full-Page Dashboard)
    if (ownerDashToggleAddUserBtn && ownerDashAddUserPanel) {
      ownerDashToggleAddUserBtn.addEventListener('click', () => {
        const isHidden = ownerDashAddUserPanel.style.display === 'none';
        ownerDashAddUserPanel.style.display = isHidden ? 'block' : 'none';
      });
    }

    if (ownerDashCancelAddUserBtn && ownerDashAddUserPanel) {
      ownerDashCancelAddUserBtn.addEventListener('click', () => {
        ownerDashAddUserPanel.style.display = 'none';
      });
    }

    if (ownerDashSaveNewUserBtn) {
      ownerDashSaveNewUserBtn.addEventListener('click', async () => {
        const full_name = ownerDashNewUserName?.value.trim();
        const email = ownerDashNewUserEmail?.value.trim();
        const password = ownerDashNewUserPassword?.value;
        const role = ownerDashNewUserRole?.value || 'staff';
        const practice_id = ownerDashNewUserPracticeSelect?.value;

        if (!full_name || !email || !password || (role !== 'owner' && !practice_id)) {
          await openCustomNotice('Missing Fields', 'Please fill in Full Name, Email, Password, and Assigned Clinic.');
          return;
        }

        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name, email, password, role, practice_id })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (ownerDashNewUserName) ownerDashNewUserName.value = '';
          if (ownerDashNewUserEmail) ownerDashNewUserEmail.value = '';
          if (ownerDashNewUserPassword) ownerDashNewUserPassword.value = '';
          if (ownerDashAddUserPanel) ownerDashAddUserPanel.style.display = 'none';
          await loadOwnerClinicsAndUsers();
          displayToast(`Created & assigned user: ${email}`);
        } else {
          await openCustomNotice('Could Not Create User', data.error || 'Could not create user.');
        }
      });
    }

    if (openAuthModalBtn) {
      openAuthModalBtn.addEventListener('click', () => {
        if (authModal) authModal.classList.add('active');
        if (loginErrorMsg) loginErrorMsg.style.display = 'none';
      });
    }

    if (closeAuthModalBtn) {
      closeAuthModalBtn.addEventListener('click', () => {
        if (authModal) authModal.classList.remove('active');
      });
    }

    if (btnCloseAuthModalBtn) {
      btnCloseAuthModalBtn.addEventListener('click', () => {
        if (authModal) authModal.classList.remove('active');
      });
    }

    if (authModal) {
      authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
          authModal.classList.remove('active');
        }
      });
    }

    if (authLoginForm) {
      authLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (loginErrorMsg) loginErrorMsg.style.display = 'none';
        if (btnSubmitLogin) {
          btnSubmitLogin.disabled = true;
          btnSubmitLogin.textContent = 'Signing in...';
        }
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: loginEmail.value.trim(),
              password: loginPassword.value,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            await setCurrentUser(data.user);
            if (authModal) authModal.classList.remove('active');
            displayToast(`Welcome, ${data.user.full_name}!`);
            resetInactivityTimer();
          } else {
            if (loginErrorMsg) {
              loginErrorMsg.textContent = data.error || 'Invalid credentials.';
              loginErrorMsg.style.display = 'block';
            }
          }
        } catch (err) {
          if (loginErrorMsg) {
            loginErrorMsg.textContent = 'Network or server connection failed.';
            loginErrorMsg.style.display = 'block';
          }
        } finally {
          if (btnSubmitLogin) {
            btnSubmitLogin.disabled = false;
            btnSubmitLogin.textContent = 'Sign In to Practice';
          }
        }
      });
    }

    if (btnLogoutStaff) {
      btnLogoutStaff.addEventListener('click', async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {}
        if (authModal) authModal.classList.remove('active');
        await setCurrentUser(null);
        displayToast('Logged out of clinic workspace.');
      });
    }

    // ==========================================
    // HIPAA 15-MINUTE INACTIVITY AUTO-LOGOUT
    // ==========================================
    const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 mins
    const WARNING_DURATION_MS = 60 * 1000;       // 60 secs
    const WARNING_TRIGGER_MS = INACTIVITY_TIMEOUT_MS - WARNING_DURATION_MS; // 14 mins

    let inactivityTimer = null;
    let warningCountdownTimer = null;
    let secondsRemaining = 60;

    function resetInactivityTimer() {
      if (inactivityWarningModal && inactivityWarningModal.classList.contains('active')) {
        inactivityWarningModal.classList.remove('active');
      }
      if (warningCountdownTimer) {
        clearInterval(warningCountdownTimer);
        warningCountdownTimer = null;
      }
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      inactivityTimer = setTimeout(triggerInactivityWarning, WARNING_TRIGGER_MS);
    }

    function triggerInactivityWarning() {
      if (!currentUser) return;
      secondsRemaining = 60;
      if (inactivityCountdownSec) inactivityCountdownSec.textContent = secondsRemaining;
      if (inactivityWarningModal) inactivityWarningModal.classList.add('active');

      warningCountdownTimer = setInterval(() => {
        secondsRemaining--;
        if (inactivityCountdownSec) inactivityCountdownSec.textContent = secondsRemaining;
        if (secondsRemaining <= 0) {
          clearInterval(warningCountdownTimer);
          warningCountdownTimer = null;
          executeAutoLogout();
        }
      }, 1000);
    }

    async function executeAutoLogout() {
      if (inactivityWarningModal) inactivityWarningModal.classList.remove('active');
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (e) {}
      await setCurrentUser(null);
      if (gateErrorMsg) {
        gateErrorMsg.textContent = '🔒 Session locked after 15 minutes of inactivity (HIPAA Safeguard). Please sign in again.';
        gateErrorMsg.style.display = 'block';
      }
      displayToast('🔒 Session timed out after 15 minutes of inactivity.');
    }

    // Register active user movement listeners
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach((evt) => {
      window.addEventListener(evt, () => {
        if (!inactivityWarningModal || !inactivityWarningModal.classList.contains('active')) {
          resetInactivityTimer();
        }
      }, { passive: true });
    });

    if (stayLoggedInBtn) {
      stayLoggedInBtn.addEventListener('click', () => {
        resetInactivityTimer();
        displayToast('Session extended.');
      });
    }

    if (logoutNowBtn) {
      logoutNowBtn.addEventListener('click', () => {
        executeAutoLogout();
      });
    }

    // Start initial inactivity timer
    resetInactivityTimer();

    // ==========================================
    // PATIENT VERIFICATION HISTORY LOGIC (POSTGRESQL + LOCAL CACHE)
    // ==========================================
    let cachedServerHistory = [];

    async function syncHistoryFromBackend() {
      try {
        const res = await fetch('/api/verifications');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.history)) {
            cachedServerHistory = json.history.map(row => ({
              id: row.id,
              practiceId: row.practice_id,
              practiceName: row.practice_name || '',
              isDbRecord: true,
              timestamp: row.created_at,
              displayDate: new Date(row.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
              patientName: row.patient_name || 'Patient',
              carrier: row.carrier || 'Dental Insurance',
              networkStatus: row.network_status || 'In-Network',
              verifiedBy: row.verified_by || 'Clinic Staff',
              readinessStatus: row.readiness_status || 'Complete / Ready for Appointment',
              codesCount: 30,
              data: null,
            }));
            updateHistoryCountUI();
            return cachedServerHistory;
          }
        }
      } catch (e) {
        console.warn('Backend history sync:', e);
      }
      return null;
    }

    function getAuditHistory() {
      if (currentUser) {
        return Array.isArray(cachedServerHistory) ? cachedServerHistory : [];
      }
      if (cachedServerHistory && cachedServerHistory.length > 0) {
        return cachedServerHistory;
      }
      return [];
    }

    function saveAuditToHistory(auditData) {
      if (!auditData || auditData.is_sample) return;
      try {
        const d = auditData.insurance_details || {};
        const pName = (d.patient_name && d.patient_name.trim() !== '') ? d.patient_name.trim() : 'Patient (Unspecified)';
        if (pName === 'Katherine Birdwell' || auditData.is_sample) return;
        const carrier = d.carrier || 'Dental Insurance';
        const auditMeta = auditData.audit_meta || {};

        const historyRecord = {
          id: auditData.verification_id || ('hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
          practiceName: currentUser?.practice_name || 'Clinic Workspace',
          timestamp: new Date().toISOString(),
          displayDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          patientName: pName,
          carrier: carrier,
          networkStatus: d.network_status || 'In-Network',
          verifiedBy: auditMeta.verified_by_name || currentUser?.full_name || 'Clinic Staff',
          readinessStatus: auditMeta.readiness_status || 'Complete / Ready for Appointment',
          codesCount: (auditData.procedure_codes || []).length,
          data: auditData,
        };

        // Prepend to cachedServerHistory for active clinic
        cachedServerHistory.unshift(historyRecord);
        updateHistoryCountUI();
      } catch (e) {
        console.warn('Could not save audit to history:', e);
      }
    }

    async function deleteHistoryItem(id) {
      try {
        // If it's a UUID/DB record, delete on server
        if (typeof id === 'string' && id.includes('-')) {
          try {
            await fetch(`/api/verifications/${id}`, { method: 'DELETE' });
          } catch (e) {}
        }
        cachedServerHistory = cachedServerHistory.filter(item => item.id !== id);
        try {
          const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw).filter(item => item.id !== id);
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(parsed));
          }
        } catch (e) {}

        renderHistoryList();
        updateHistoryCountUI();
        displayToast('History item deleted.');
      } catch (e) {
        console.warn('Could not delete history item:', e);
      }
    }

    async function clearAllHistory() {
      const ok = await openCustomConfirm(
        'Clear Verification History',
        'Are you sure you want to clear all patient verification history?',
        'Clear History',
        'Cancel'
      );
      if (!ok) return;
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      cachedServerHistory = [];
      renderHistoryList();
      updateHistoryCountUI();
      displayToast('All verification history cleared.');
    }

    function updateHistoryCountUI() {
      const list = getAuditHistory();
      const count = list.length;
      if (headerHistoryCount) headerHistoryCount.textContent = `History (${count})`;
      if (historyModalCount) historyModalCount.textContent = count;
    }

    function renderHistoryList() {
      let list = getAuditHistory();
      const searchTerm = (historySearchInput?.value || '').trim().toLowerCase();
      if (searchTerm) {
        list = list.filter(item =>
          (item.patientName && item.patientName.toLowerCase().includes(searchTerm)) ||
          (item.carrier && item.carrier.toLowerCase().includes(searchTerm)) ||
          (item.practiceName && item.practiceName.toLowerCase().includes(searchTerm)) ||
          (item.networkStatus && item.networkStatus.toLowerCase().includes(searchTerm)) ||
          (item.verifiedBy && item.verifiedBy.toLowerCase().includes(searchTerm)) ||
          (item.readinessStatus && item.readinessStatus.toLowerCase().includes(searchTerm)) ||
          (item.displayDate && item.displayDate.toLowerCase().includes(searchTerm))
        );
      }

      updateHistoryCountUI();
      if (!historyListContainer) return;

      historyListContainer.innerHTML = '';

      if (list.length === 0) {
        historyListContainer.innerHTML = `
          <div class="history-empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <div style="font-size: 1rem; font-weight: 600; color: #fff;">${searchTerm ? 'No Matching Patient Verifications Found' : 'No Patient Verifications Recorded Yet'}</div>
            <div style="font-size: 0.825rem; max-width: 380px;">${searchTerm ? 'Try searching by another patient name, carrier, or status.' : 'Whenever you analyze an insurance breakdown, it will automatically save here so you can review previous patient benefits anytime without re-uploading.'}</div>
          </div>
        `;
        return;
      }

      list.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'history-card-item';
        const statusStr = String(item.readinessStatus || 'Complete / Ready for Appointment');
        const statusLow = statusStr.toLowerCase();
        let statusStyle = 'background: rgba(16, 185, 129, 0.14); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35);';
        let statusIcon = '✅';
        if (statusLow.includes('pending')) {
          statusStyle = 'background: rgba(245, 158, 11, 0.14); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35);';
          statusIcon = '⏳';
        } else if (statusLow.includes('termed') || statusLow.includes('inactive')) {
          statusStyle = 'background: rgba(244, 63, 94, 0.14); color: #fda4af; border: 1px solid rgba(244, 63, 94, 0.35);';
          statusIcon = '❌';
        }

        card.innerHTML = `
          <div class="history-card-left">
            <div class="history-patient-row" style="flex-wrap: wrap;">
              <span class="patient-hero-badge" style="padding: 0.15rem 0.6rem; font-size: 0.775rem;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                ${escapeHtml(item.patientName)}
              </span>
              <span class="history-patient-title">${escapeHtml(item.carrier)}</span>
              ${item.practiceName ? `<span class="user-role-badge staff" style="font-size: 0.62rem;">🏥 ${escapeHtml(item.practiceName)}</span>` : ''}
              <span style="padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.65rem; font-weight: 700; ${statusStyle}">
                ${statusIcon} ${escapeHtml(statusStr)}
              </span>
            </div>
            <div class="history-meta-info" style="flex-wrap: wrap;">
              <span>Verified: ${escapeHtml(item.displayDate)}</span>
              <span>•</span>
              <span style="color: #93c5fd;">👤 By: ${escapeHtml(item.verifiedBy || 'Clinic Staff')}</span>
              <span>•</span>
              <span style="color: ${(item.networkStatus || '').toLowerCase().includes('out') ? '#fda4af' : '#38bdf8'};">${escapeHtml(item.networkStatus || 'In-Network')}</span>
              <span>•</span>
              <span>${item.codesCount || 30} CDT codes</span>
            </div>
          </div>
          <div class="history-actions-row">
            <button type="button" class="btn-history-load load-hist-btn" title="View & Edit Patient Breakdown">
              Load / Edit
            </button>
            <button type="button" class="btn-history-delete del-hist-btn" title="Delete record">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        `;

        async function handleLoadAudit(e) {
          if (e) e.stopPropagation();
          const loadBtn = card.querySelector('.load-hist-btn');
          if (loadBtn) loadBtn.textContent = 'Loading...';

          try {
            if (!item.data && (item.isDbRecord || (typeof item.id === 'string' && item.id.includes('-')))) {
              const res = await fetch(`/api/verifications/${item.id}`);
              const json = await res.json();
              if (json.success && json.record) {
                item.data = json.record;
              }
            }

            if (item.data) {
              currentAuditData = item.data;
              renderReportDashboard(currentAuditData);
              historyModal.classList.remove('active');
              displayToast(`Loaded audit for: ${item.patientName}`);
            } else {
              displayToast('Could not load breakdown data for this item.');
            }
          } catch (loadErr) {
            console.error('Failed to load breakdown:', loadErr);
            displayToast('Error loading breakdown record.');
          } finally {
            if (loadBtn) loadBtn.textContent = 'Load Audit';
          }
        }

        const loadBtn = card.querySelector('.load-hist-btn');
        loadBtn.addEventListener('click', handleLoadAudit);
        card.addEventListener('click', handleLoadAudit);

        const delBtn = card.querySelector('.del-hist-btn');
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteHistoryItem(item.id);
        });

        historyListContainer.appendChild(card);
      });
    }

    if (historySearchInput) {
      historySearchInput.addEventListener('input', () => {
        renderHistoryList();
      });
    }

    if (openHistoryBtn) {
      openHistoryBtn.addEventListener('click', async () => {
        await syncHistoryFromBackend();
        renderHistoryList();
        historyModal.classList.add('active');
      });
    }

    if (closeHistoryModalBtn) {
      closeHistoryModalBtn.addEventListener('click', () => {
        historyModal.classList.remove('active');
      });
    }

    if (btnCloseHistoryFooterBtn) {
      btnCloseHistoryFooterBtn.addEventListener('click', () => {
        historyModal.classList.remove('active');
      });
    }

    if (btnClearHistoryBtn) {
      btnClearHistoryBtn.addEventListener('click', () => {
        clearAllHistory();
      });
    }

    if (historyModal) {
      historyModal.addEventListener('click', (e) => {
        if (e.target === historyModal) {
          historyModal.classList.remove('active');
        }
      });
    }

    // Startup initializations
    updateHistoryCountUI();
    checkUserAuth();

