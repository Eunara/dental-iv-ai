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
        ortho_age_limit: "26"
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

    // Exact Procedure Clinical Sequence Mapping (Strict order 1-19 from plan.txt)
    function getProcedureOrderRank(code) {
      if (!code) return 999;
      const c = String(code).trim().toUpperCase();
      // 1-10: Preventative
      if (c.includes('D4346')) return 1;
      if (c.includes('D1110')) return 2;
      if (c.includes('D0274')) return 3;
      if (c.includes('D0210') || c.includes('D0330')) return 4;
      if (c.includes('D0220')) return 5;
      if (c.includes('D9110')) return 6;
      if (c.includes('D0120')) return 7;
      if (c.includes('D0140')) return 8;
      if (c.includes('D1351')) return 9;
      if (c.includes('D1206')) return 10;
      // 11-12: Periodontal
      if (c.includes('D4341')) return 11;
      if (c.includes('D4910')) return 12;
      // 13: Restorative (D2391)
      if (c.includes('D2391')) return 13;
      // 14-19: Major
      if (c.includes('D2740')) return 14;
      if (c.includes('D2920')) return 15;
      if (c.includes('D7140')) return 16;
      if (c.includes('D7210')) return 17;
      if (c.includes('D9222') || c.includes('D9223')) return 18;
      if (c.includes('D9944')) return 19;
      if (c.includes('D6010')) return 20;
      return 100;
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

    // ── Pre-configured Payer Addresses & Payor IDs Directory ──────────
    const PAYER_DIRECTORY_STORAGE_KEY = 'dentverify_payer_directory';
    const DEFAULT_PAYER_DIRECTORY = [
      {
        id: 'payer_metlife',
        name: 'MetLife Dental',
        network: 'In-Network',
        matchKeys: ['metlife', 'met life'],
        address: 'P.O. Box 981282 El Paso, TX 79998',
        phone: '(877) 638-3379',
        payorId: '65978'
      },
      {
        id: 'payer_delta',
        name: 'Delta Dental',
        network: 'In-Network',
        matchKeys: ['delta dental', 'delta'],
        address: 'P.O. Box 9051 Farmington Hills, MI 48333',
        phone: '(800) 524-0149',
        payorId: '05430'
      },
      {
        id: 'payer_ameritas',
        name: 'Ameritas Life Insurance',
        network: 'In-Network',
        matchKeys: ['ameritas'],
        address: 'P.O. Box 81889 Lincoln, NE 68501',
        phone: '(800) 487-5553',
        payorId: '47009'
      },
      {
        id: 'payer_cigna',
        name: 'Cigna Dental',
        network: 'In-Network',
        matchKeys: ['cigna'],
        address: 'P.O. Box 188037 Chattanooga, TN 37422',
        phone: '(800) 244-6224',
        payorId: '62308'
      },
      {
        id: 'payer_guardian',
        name: 'Guardian Dental',
        network: 'In-Network',
        matchKeys: ['guardian'],
        address: 'P.O. Box 981572 El Paso, TX 79998',
        phone: '(800) 541-7846',
        payorId: '13463'
      },
      {
        id: 'payer_aetna',
        name: 'Aetna Dental',
        network: 'In-Network',
        matchKeys: ['aetna'],
        address: 'P.O. Box 14094 Lexington, KY 40512',
        phone: '(877) 238-6200',
        payorId: '60054'
      },
      {
        id: 'payer_uhc',
        name: 'UnitedHealthcare Dental',
        network: 'In-Network',
        matchKeys: ['unitedhealthcare', 'united healthcare', 'uhc'],
        address: 'P.O. Box 30567 Salt Lake City, UT 84130',
        phone: '(877) 816-3596',
        payorId: '52133'
      },
      {
        id: 'payer_bcbs',
        name: 'Blue Cross Blue Shield (BCBS)',
        network: 'In-Network',
        matchKeys: ['blue cross', 'bluecross', 'bcbs', 'anthem', 'regence', 'premera', 'horizon', 'carefirst'],
        address: 'P.O. Box 660247 Dallas, TX 75266',
        phone: '(800) 521-2227',
        payorId: '84980'
      },
      {
        id: 'payer_humana',
        name: 'Humana Dental',
        network: 'Out-of-Network',
        matchKeys: ['humana'],
        address: 'P.O. Box 14611 Lexington, KY 40512',
        phone: '(800) 233-4013',
        payorId: '61101'
      },
      {
        id: 'payer_principal',
        name: 'Principal Financial Group',
        network: 'In-Network',
        matchKeys: ['principal'],
        address: 'P.O. Box 10350 Des Moines, IA 50306',
        phone: '(800) 247-4695',
        payorId: '61271'
      }
    ];

    function getPayerDirectory() {
      try {
        const raw = localStorage.getItem(PAYER_DIRECTORY_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map(item => ({
              ...item,
              network: item.network || 'In-Network'
            }));
          }
        }
      } catch (e) {
        console.warn('Could not read payer directory:', e);
      }
      return DEFAULT_PAYER_DIRECTORY.slice();
    }

    function savePayerDirectory(list) {
      try {
        localStorage.setItem(PAYER_DIRECTORY_STORAGE_KEY, JSON.stringify(list));
      } catch (e) {
        console.warn('Could not save payer directory:', e);
      }
    }

    function matchPayerDirectory(carrierName) {
      if (!carrierName || typeof carrierName !== 'string') return null;
      const c = carrierName.toLowerCase().trim();
      const list = getPayerDirectory();
      for (const p of list) {
        if (p.name && c.includes(p.name.toLowerCase())) return p;
        if (Array.isArray(p.matchKeys)) {
          for (const k of p.matchKeys) {
            if (c.includes(k.toLowerCase())) return p;
          }
        }
      }
      return null;
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

        renderReportDashboard(currentAuditData);
        saveAuditToHistory(currentAuditData);
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

    // Render verification report
    function renderReportDashboard(data) {
      if (data) {
        if (data.insurance_details) {
          data.insurance_details = enforcePolicyTermedRules(data.insurance_details);
        }
        if (Array.isArray(data.procedure_codes)) {
          data.procedure_codes = enforceSharedFmxPanoRules(data.procedure_codes);
          data.procedure_codes = enforceAgeLimitAndFrequencyRules(data.procedure_codes, data.insurance_details || {});
        }
      }
      const details = data.insurance_details || {};
      const levels = data.coverage_levels || {};

      // Auto-populate Claims Address, Payor ID, and pre-configured Network Status from Directory
      if (details.carrier) {
        const matchedPayer = matchPayerDirectory(details.carrier);
        if (matchedPayer) {
          if (!details.insurance_address || /^(none|n\/a|na|-)$/i.test(details.insurance_address.trim())) {
            details.insurance_address = matchedPayer.address;
          }
          if (!details.insurance_phone || /^(none|n\/a|na|-)$/i.test(details.insurance_phone.trim())) {
            details.insurance_phone = matchedPayer.phone;
          }
          if (!details.payor_id || /^(none|n\/a|na|-)$/i.test(details.payor_id.trim())) {
            details.payor_id = matchedPayer.payorId;
          }
          // Pre-configured clinic network participation
          if (matchedPayer.network) {
            details.network_status = matchedPayer.network;
          }
        }
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

      // Carrier Name & Claims Mailing Address in Top Banner
      const carrierNameDisplay = document.getElementById('carrierNameDisplay');
      if (carrierNameDisplay) carrierNameDisplay.textContent = details.carrier || 'Dental Insurance';

      const carrierAddressDisplay = document.getElementById('carrierAddressDisplay');
      if (carrierAddressDisplay) {
        const addr = (details.insurance_address && !/^(none|n\/a|na|-)$/i.test(details.insurance_address.trim())) ? details.insurance_address.trim() : '';
        const ph = (details.insurance_phone && !/^(none|n\/a|na|-)$/i.test(details.insurance_phone.trim())) ? details.insurance_phone.trim() : '';
        let addrParts = [];
        if (addr) addrParts.push(`Claims Address: ${addr}`);
        if (ph) addrParts.push(`Ph: ${ph}`);
        if (addrParts.length > 0) {
          carrierAddressDisplay.textContent = addrParts.join(' • ');
        } else {
          carrierAddressDisplay.textContent = 'Claims Address: N/A';
        }
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
        heroNetBadge.title = `Click to toggle In-Network / Out-of-Network`;

        if (!heroNetBadge.dataset.listenerAttached) {
          heroNetBadge.dataset.listenerAttached = 'true';
          heroNetBadge.addEventListener('click', () => {
            if (!currentAuditData || !currentAuditData.insurance_details) return;
            const curNet = currentAuditData.insurance_details.network_status || 'In-Network';
            const newNet = curNet.toLowerCase().includes('out') ? 'In-Network' : 'Out-of-Network';
            currentAuditData.insurance_details.network_status = newNet;

            // Also remember this preference in Payer Directory
            const carrier = currentAuditData.insurance_details.carrier;
            if (carrier) {
              const list = getPayerDirectory();
              const matched = list.find(p => p.name && (carrier.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(carrier.toLowerCase())));
              if (matched) {
                matched.network = newNet;
                savePayerDirectory(list);
              }
            }

            renderReportDashboard(currentAuditData);
            renderExcelBreakdownSheet(currentAuditData);
            if (pmsModal && pmsModal.classList.contains('active')) buildPmsNote();
            displayToast(`Network status toggled to: ${newNet} (Saved to Directory)`);
          });
        }
      }

      const heroCarrierSubDisplay = document.getElementById('heroCarrierSubDisplay');
      if (heroCarrierSubDisplay) {
        const addr = (details.insurance_address && !/^(none|n\/a|na|-)$/i.test(details.insurance_address.trim())) ? details.insurance_address.trim() : '';
        let sub = details.carrier || 'Dental Insurance';
        if (addr) {
          sub += ` • ${addr}`;
        }
        heroCarrierSubDisplay.textContent = sub;
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

      // Orthodontics Card in policy-hero-card
      const oMaxStr = levels.ortho_max || '$1,000';
      const oRemStr = levels.ortho_remaining || '$999';
      const oAgeStr = levels.ortho_age_limit || '26';
      const oCovStr = levels.ortho || '50%';

      const hudOrthoMaxEl = document.getElementById('hudOrthoMax');
      if (hudOrthoMaxEl) hudOrthoMaxEl.textContent = oMaxStr;

      const hudOrthoRemEl = document.getElementById('hudOrthoRem');
      if (hudOrthoRemEl) hudOrthoRemEl.textContent = 'Ortho Rem: ' + oRemStr;

      const hudOrthoAgeLimitEl = document.getElementById('hudOrthoAgeLimit');
      if (hudOrthoAgeLimitEl) hudOrthoAgeLimitEl.textContent = 'Age limit: ' + oAgeStr;

      const hudOrthoCoveragePillEl = document.getElementById('hudOrthoCoveragePill');
      if (hudOrthoCoveragePillEl) hudOrthoCoveragePillEl.textContent = oCovStr;

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
        cBox.innerHTML = `
          <div class="category-code-tag">${item.code}</div>
          <div class="category-name-text">${item.name}</div>
          <div class="category-percentage-num">${item.val}</div>
          <div class="category-sub-note">${item.sub}</div>
        `;
        categoryCardsGrid.appendChild(cBox);
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

          tr.innerHTML = `
            <td><span class="cdt-badge">${escapeHtml(p.code || 'CDT')}</span></td>
            <td class="desc-text">${escapeHtml(p.description || '-')}</td>
            <td><span class="editable-cell" data-code="${escapeHtml(p.code)}" data-field="coverage_percentage" title="Click to edit Benefit %"><span class="pct-badge-num" style="color: #38bdf8;">${escapeHtml(p.coverage_percentage || '0%')}</span>${editIcon}</span></td>
            <td><span class="clickable-toggle-pill" data-code="${escapeHtml(p.code)}" data-field="deductible_applied" title="Click to toggle Deductible">${dedCell}</span></td>
            <td><span class="editable-cell" data-code="${escapeHtml(p.code)}" data-field="frequency_limitation" title="Click to edit Frequency">${escapeHtml(p.frequency_limitation || '-')}${editIcon}</span></td>
            <td><span class="editable-cell" data-code="${escapeHtml(p.code)}" data-field="age_limit" title="Click to edit Age Limit">${escapeHtml(p.age_limit || 'None')}${editIcon}</span></td>
            <td><span class="clickable-toggle-pill" data-code="${escapeHtml(p.code)}" data-field="is_eligible" title="Click to toggle Eligibility">${statusBadge}</span></td>
            <td><span class="editable-cell history-text" data-code="${escapeHtml(p.code)}" data-field="history_dates" title="Click to edit History on File">${escapeHtml(p.history_dates || 'None')}${editIcon}</span></td>
            <td><span class="editable-cell" data-code="${escapeHtml(p.code)}" data-field="downgrade_rule" title="Click to edit Downgrade Clause">${downgradeCell}${editIcon}</span></td>
            <td class="notes-snippet">${escapeHtml(p.notes || '-')}</td>
          `;

          cdtTableBody.appendChild(tr);
        });
      });
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
            if (field === 'frequency_limitation' && !val) val = '-';
            if (field === 'coverage_percentage' && !val) val = '0%';
            p[field] = val;
            displayToast(`Updated ${code} ${field.replace('_', ' ')}`);
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
      const codes = (currentAuditData.procedure_codes || []).slice();

      // Strictly sort by clinical 1-to-21 sequence
      codes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));

      const today = new Date().toLocaleDateString('en-US');

      let txt = `==========================================================\n`;
      txt += `DENTAL INSURANCE VERIFICATION AUDIT [${today}]\n`;
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
      txt += ` • Orthodontics:      ${c.ortho || '50%'} (Max: ${c.ortho_max || '$1,000'}, Remaining: ${c.ortho_remaining || c.ortho_max || '$1,000'}, Age Limit: ${c.ortho_age_limit || '14 Maximum'})\n`;
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
    // EXCEL BREAKDOWN SHEET & PDF (OPTION 4)
    // ==========================================
    const openExcelModalBtn = document.getElementById('openExcelModalBtn');
    const excelModal = document.getElementById('excelModal');
    const closeExcelModalBtn = document.getElementById('closeExcelModalBtn');
    const printExcelModalBtn = document.getElementById('printExcelModalBtn');
    const copyExcelTableBtn = document.getElementById('copyExcelTableBtn');

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
      const termedDate = d.termed_date || 'Active (None)';
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
      const missingTooth = d.missing_tooth_clause ? 'Yes' : 'No';
      const waitingPeriod = d.waiting_period ? (c.waiting_period_details || 'Yes') : ('No (' + (c.waiting_period_details || 'Basic 6mo Major 12') + ')');

      function csvCell(val) {
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      }

      let lines = [];
      lines.push([csvCell('DENTAL INSURANCE BENEFIT BREAKDOWN FORM')].join(','));
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
        csvCell(`${orthoCoverage} (Rem: ${orthoRemaining}, Age: ${orthoAgeLimit})`)
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
      const allCodes = (data.procedure_codes || []).slice();

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

      // Sort all codes strictly in clinical 1-to-19 sequence
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
          <div class="excel-sheet-header-title">DENTAL INSURANCE BENEFIT BREAKDOWN FORM</div>
          
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
              <td class="excel-label-cell">Ins Company:</td>
              <td class="excel-val-cell" style="font-weight: 700; color: #0f172a;">${escapeHtml(carrier)}</td>
              <td class="excel-label-cell">Ins Ph #:</td>
              <td class="excel-val-cell">${escapeHtml(insPhone)}</td>
            </tr>
            <tr>
              <td class="excel-label-cell">Ins Address:</td>
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
              <td class="excel-val-cell" colspan="3">${escapeHtml(dedScope)}</td>
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
              <td class="excel-val-cell">${escapeHtml(orthoCoverage)}</td>
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
                <div class="cat-h">Ortho</div>
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
            Generated by DentVerify AI (dentverify.com) • Verification audit grounded in uploaded carrier breakdown
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
    // AI SETTINGS & PROMPTS CONFIGURATION LOGIC
    // ==========================================
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
    const settingSystemInstruction = document.getElementById('settingSystemInstruction');
    const settingCustomPrompt = document.getElementById('settingCustomPrompt');
    const btnRestoreDefaults = document.getElementById('btnRestoreDefaults');
    const btnSaveSettings = document.getElementById('btnSaveSettings');
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

    // Fetch and sync default or saved prompt settings
    async function loadPromptSettings() {
      try {
        const storedSys = localStorage.getItem('dentverify_system_instruction');
        const storedPr = localStorage.getItem('dentverify_custom_prompt');

        if (storedSys && storedPr) {
          settingSystemInstruction.value = storedSys;
          settingCustomPrompt.value = storedPr;
          return;
        }

        const res = await fetch('/api/prompts/default');
        if (res.ok) {
          const data = await res.json();
          if (!storedSys) settingSystemInstruction.value = data.systemInstruction || '';
          if (!storedPr) settingCustomPrompt.value = data.customPrompt || '';
        }
      } catch (e) {
        console.warn('Could not load default prompts:', e);
      }
    }

    // Open Settings Modal
    openSettingsBtn.addEventListener('click', () => {
      loadPromptSettings();
      renderPayerDirectory(payerSearchInput?.value || '');
      settingsModal.classList.add('active');
    });

    // Close Settings Modal
    closeSettingsModalBtn.addEventListener('click', () => {
      settingsModal.classList.remove('active');
    });

    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
      }
    });

    // Save Settings
    btnSaveSettings.addEventListener('click', () => {
      const sysVal = settingSystemInstruction.value.trim();
      const prVal = settingCustomPrompt.value.trim();
      if (sysVal) localStorage.setItem('dentverify_system_instruction', sysVal);
      if (prVal) localStorage.setItem('dentverify_custom_prompt', prVal);
      settingsModal.classList.remove('active');
      displayToast('AI Directives saved! Applied to breakdown audits.');
    });

    // Restore Factory Defaults
    btnRestoreDefaults.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/prompts/default');
        if (res.ok) {
          const data = await res.json();
          settingSystemInstruction.value = data.systemInstruction || '';
          settingCustomPrompt.value = data.customPrompt || '';
          localStorage.removeItem('dentverify_system_instruction');
          localStorage.removeItem('dentverify_custom_prompt');
          displayToast('Restored default AI prompt directives.');
        }
      } catch (e) {
        displayToast('Could not fetch default prompts.');
      }
    });

    // Initialize prompt values on page load
    loadPromptSettings();

    // ==========================================
    // PAYER DIRECTORY UI LOGIC
    // ==========================================
    const payerSearchInput = document.getElementById('payerSearchInput');
    const toggleAddPayerFormBtn = document.getElementById('toggleAddPayerFormBtn');
    const addPayerFormPanel = document.getElementById('addPayerFormPanel');
    const newPayerName = document.getElementById('newPayerName');
    const newPayerId = document.getElementById('newPayerId');
    const newPayerAddress = document.getElementById('newPayerAddress');
    const newPayerPhone = document.getElementById('newPayerPhone');
    const cancelAddPayerBtn = document.getElementById('cancelAddPayerBtn');
    const saveNewPayerBtn = document.getElementById('saveNewPayerBtn');
    const payerDirectoryListContainer = document.getElementById('payerDirectoryListContainer');
    const openPayerDirectoryQuickBtn = document.getElementById('openPayerDirectoryQuickBtn');

    function renderPayerDirectory(filter = '') {
      if (!payerDirectoryListContainer) return;
      payerDirectoryListContainer.innerHTML = '';
      const list = getPayerDirectory();
      const q = filter.trim().toLowerCase();

      const filtered = list.filter(p => {
        if (!q) return true;
        return (p.name || '').toLowerCase().includes(q) ||
               (p.address || '').toLowerCase().includes(q) ||
               (p.payorId || '').toLowerCase().includes(q) ||
               (p.phone || '').toLowerCase().includes(q) ||
               (p.network || '').toLowerCase().includes(q);
      });

      if (filtered.length === 0) {
        payerDirectoryListContainer.innerHTML = `
          <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.78rem;">
            No insurance carriers found matching "${escapeHtml(filter)}".
          </div>
        `;
        return;
      }

      filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'payer-directory-card';
        const isOut = (p.network || 'In-Network').toLowerCase().includes('out');
        const netLabel = isOut ? 'Out-of-Network' : 'In-Network';

        card.innerHTML = `
          <div class="payer-card-info">
            <div class="payer-card-name">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              <span>${escapeHtml(p.name)}</span>
              <button type="button" class="payer-network-toggle-badge ${isOut ? 'out' : 'in'}" data-id="${p.id}" title="Click to toggle In-Network / Out-of-Network for this carrier">
                ${netLabel}
              </button>
            </div>
            <div class="payer-card-addr">${escapeHtml(p.address)}</div>
            <div class="payer-card-meta">
              <span>Ph: ${escapeHtml(p.phone || 'N/A')}</span>
              <span>•</span>
              <span>Payor ID: <strong>${escapeHtml(p.payorId || 'N/A')}</strong></span>
            </div>
          </div>
          <div style="display: flex; gap: 0.4rem; align-items: center;">
            <button type="button" class="btn-apply-payer" data-id="${p.id || ''}" title="Apply this address, network status, and Payor ID to the active policy card and exports">
              Apply to Policy
            </button>
            ${p.isCustom ? `
              <button type="button" class="del-payer-btn" data-id="${p.id}" title="Delete custom payer" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            ` : ''}
          </div>
        `;

        // Network toggle badge click
        const netBtn = card.querySelector('.payer-network-toggle-badge');
        if (netBtn) {
          netBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const allPayers = getPayerDirectory();
            const targetPayer = allPayers.find(item => item.id === p.id);
            if (targetPayer) {
              const curNet = targetPayer.network || 'In-Network';
              targetPayer.network = curNet.toLowerCase().includes('out') ? 'In-Network' : 'Out-of-Network';
              savePayerDirectory(allPayers);
              renderPayerDirectory(payerSearchInput?.value || '');

              // If active breakdown matches, sync immediately
              if (currentAuditData && currentAuditData.insurance_details && currentAuditData.insurance_details.carrier) {
                const c = currentAuditData.insurance_details.carrier.toLowerCase();
                if (c.includes(targetPayer.name.toLowerCase()) || targetPayer.name.toLowerCase().includes(c)) {
                  currentAuditData.insurance_details.network_status = targetPayer.network;
                  renderReportDashboard(currentAuditData);
                  renderExcelBreakdownSheet(currentAuditData);
                  if (pmsModal && pmsModal.classList.contains('active')) buildPmsNote();
                }
              }

              displayToast(`${targetPayer.name} is now set as ${targetPayer.network}!`);
            }
          });
        }

        const applyBtn = card.querySelector('.btn-apply-payer');
        applyBtn.addEventListener('click', () => {
          applyPayerToCurrentAudit(p);
        });

        const delBtn = card.querySelector('.del-payer-btn');
        if (delBtn) {
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteCustomPayer(p.id);
          });
        }

        payerDirectoryListContainer.appendChild(card);
      });
    }

    function applyPayerToCurrentAudit(payer) {
      if (!currentAuditData) {
        displayToast('No active breakdown loaded. Upload a breakdown first.');
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

      renderReportDashboard(currentAuditData);
      renderExcelBreakdownSheet(currentAuditData);
      if (pmsModal && pmsModal.classList.contains('active')) buildPmsNote();
      settingsModal.classList.remove('active');
      displayToast(`Applied ${payer.name} (${payer.network || 'In-Network'}) to policy!`);
    }

    function deleteCustomPayer(id) {
      const list = getPayerDirectory().filter(p => p.id !== id);
      savePayerDirectory(list);
      renderPayerDirectory(payerSearchInput?.value || '');
      displayToast('Custom payer deleted.');
    }

    if (payerSearchInput) {
      payerSearchInput.addEventListener('input', (e) => {
        renderPayerDirectory(e.target.value);
      });
    }

    // Bulk Import Logic
    const toggleBulkImportBtn = document.getElementById('toggleBulkImportBtn');
    const bulkImportPanel = document.getElementById('bulkImportPanel');
    const bulkImportTextarea = document.getElementById('bulkImportTextarea');
    const cancelBulkImportBtn = document.getElementById('cancelBulkImportBtn');
    const processBulkImportBtn = document.getElementById('processBulkImportBtn');

    if (toggleBulkImportBtn && bulkImportPanel) {
      toggleBulkImportBtn.addEventListener('click', () => {
        const isHidden = bulkImportPanel.style.display === 'none';
        bulkImportPanel.style.display = isHidden ? 'block' : 'none';
        if (addPayerFormPanel) addPayerFormPanel.style.display = 'none';
      });
    }

    if (cancelBulkImportBtn && bulkImportPanel) {
      cancelBulkImportBtn.addEventListener('click', () => {
        bulkImportPanel.style.display = 'none';
        if (bulkImportTextarea) bulkImportTextarea.value = '';
      });
    }

    if (processBulkImportBtn && bulkImportTextarea) {
      processBulkImportBtn.addEventListener('click', () => {
        const rawText = bulkImportTextarea.value.trim();
        if (!rawText) {
          alert('Please paste your insurance list text first.');
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

          const name = parts[0];
          let address = parts[1] || 'N/A';
          let network = 'In-Network';
          let phone = 'N/A';
          let payorId = 'N/A';

          for (let i = 2; i < parts.length; i++) {
            const val = parts[i];
            if (/^(in|in-network|in network|inn)$/i.test(val)) {
              network = 'In-Network';
            } else if (/^(out|out-of-network|out of network|oon)$/i.test(val)) {
              network = 'Out-of-Network';
            } else if (/^[0-9A-Z]{4,8}$/i.test(val) && !val.includes('(')) {
              payorId = val;
            } else if (/\d{3}[-.)]\s*\d{3}/.test(val)) {
              phone = val;
            } else if (address === 'N/A') {
              address = val;
            }
          }

          if (parts[2] && /out/i.test(parts[2])) network = 'Out-of-Network';
          else if (parts[2] && /in/i.test(parts[2])) network = 'In-Network';

          const existing = list.find(item => item.name && item.name.toLowerCase() === name.toLowerCase());
          if (existing) {
            if (address !== 'N/A') existing.address = address;
            if (network) existing.network = network;
            if (phone !== 'N/A') existing.phone = phone;
            if (payorId !== 'N/A') existing.payorId = payorId;
          } else {
            list.unshift({
              id: 'payer_custom_' + Date.now() + '_' + idx,
              name,
              network,
              matchKeys: [name.toLowerCase()],
              address,
              phone,
              payorId,
              isCustom: true
            });
          }
          importedCount++;
        });

        savePayerDirectory(list);
        bulkImportPanel.style.display = 'none';
        bulkImportTextarea.value = '';
        renderPayerDirectory();
        displayToast(`Successfully imported ${importedCount} insurance carriers into Directory!`);
      });
    }

    if (toggleAddPayerFormBtn && addPayerFormPanel) {
      toggleAddPayerFormBtn.addEventListener('click', () => {
        const isHidden = addPayerFormPanel.style.display === 'none';
        addPayerFormPanel.style.display = isHidden ? 'block' : 'none';
        if (bulkImportPanel) bulkImportPanel.style.display = 'none';
        toggleAddPayerFormBtn.textContent = isHidden ? '✕ Close Form' : '+ Add Carrier';
      });
    }

    if (cancelAddPayerBtn && addPayerFormPanel) {
      cancelAddPayerBtn.addEventListener('click', () => {
        addPayerFormPanel.style.display = 'none';
        if (toggleAddPayerFormBtn) toggleAddPayerFormBtn.textContent = '+ Add Carrier';
        if (newPayerName) newPayerName.value = '';
        if (newPayerId) newPayerId.value = '';
        if (newPayerAddress) newPayerAddress.value = '';
        if (newPayerPhone) newPayerPhone.value = '';
      });
    }

    if (saveNewPayerBtn) {
      saveNewPayerBtn.addEventListener('click', () => {
        const name = newPayerName?.value.trim();
        const address = newPayerAddress?.value.trim();
        const phone = newPayerPhone?.value.trim() || 'N/A';
        const payorId = newPayerId?.value.trim() || 'N/A';
        const newPayerNetwork = document.getElementById('newPayerNetwork');
        const network = newPayerNetwork?.value || 'In-Network';

        if (!name || !address) {
          alert('Please enter both the Carrier Name and Claims Address.');
          return;
        }

        const list = getPayerDirectory();
        const newRecord = {
          id: 'payer_custom_' + Date.now(),
          name,
          network,
          matchKeys: [name.toLowerCase()],
          address,
          phone,
          payorId,
          isCustom: true
        };

        list.unshift(newRecord);
        savePayerDirectory(list);

        if (addPayerFormPanel) addPayerFormPanel.style.display = 'none';
        if (toggleAddPayerFormBtn) toggleAddPayerFormBtn.textContent = '+ Add Carrier';
        if (newPayerName) newPayerName.value = '';
        if (newPayerId) newPayerId.value = '';
        if (newPayerAddress) newPayerAddress.value = '';
        if (newPayerPhone) newPayerPhone.value = '';

        renderPayerDirectory();
        displayToast(`Saved ${name} (${network}) to Insurance Directory!`);
      });
    }

    if (openPayerDirectoryQuickBtn) {
      openPayerDirectoryQuickBtn.addEventListener('click', () => {
        loadPromptSettings();
        settingsModal.classList.add('active');
        // Activate Tab 3
        settingsTabBtns.forEach(b => b.classList.remove('active'));
        settingsTabPanes.forEach(p => p.classList.remove('active'));
        const payerTabBtn = document.querySelector('.settings-tab-btn[data-tab="tabPayers"]');
        if (payerTabBtn) payerTabBtn.classList.add('active');
        document.getElementById('tabPayers')?.classList.add('active');
        renderPayerDirectory(payerSearchInput?.value || '');
      });
    }

    // Tab button click handler for tabPayers
    const tabPayersBtn = document.querySelector('.settings-tab-btn[data-tab="tabPayers"]');
    if (tabPayersBtn) {
      tabPayersBtn.addEventListener('click', () => {
        renderPayerDirectory(payerSearchInput?.value || '');
      });
    }

    // ==========================================
    // PATIENT VERIFICATION HISTORY LOGIC
    // ==========================================
    function getAuditHistory() {
      try {
        const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
        const list = raw ? JSON.parse(raw) : [];
        // Filter out any mock/sample test breakdowns from the history list
        return list.filter(item => !item.is_sample && !item.data?.is_sample && item.patientName !== 'Katherine Birdwell');
      } catch (e) {
        console.warn('Could not read audit history:', e);
        return [];
      }
    }

    function saveAuditToHistory(auditData) {
      if (!auditData || auditData.is_sample) return;
      try {
        const list = getAuditHistory();
        const d = auditData.insurance_details || {};
        const pName = (d.patient_name && d.patient_name.trim() !== '') ? d.patient_name.trim() : 'Patient (Unspecified)';
        if (pName === 'Katherine Birdwell' || auditData.is_sample) return;
        const carrier = d.carrier || 'Dental Insurance';
        
        const historyRecord = {
          id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          timestamp: new Date().toISOString(),
          displayDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          patientName: pName,
          carrier: carrier,
          networkStatus: d.network_status || 'In-Network',
          codesCount: (auditData.procedure_codes || []).length,
          data: auditData,
        };

        // Prepend new record, keep up to 40 recent patient verifications
        list.unshift(historyRecord);
        if (list.length > 40) list.pop();
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
        updateHistoryCountUI();
      } catch (e) {
        console.warn('Could not save audit to history:', e);
      }
    }

    function deleteHistoryItem(id) {
      try {
        const list = getAuditHistory().filter(item => item.id !== id);
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
        renderHistoryList();
        updateHistoryCountUI();
        displayToast('History item deleted.');
      } catch (e) {
        console.warn('Could not delete history item:', e);
      }
    }

    function clearAllHistory() {
      if (!confirm('Are you sure you want to clear all patient verification history?')) return;
      localStorage.removeItem(HISTORY_STORAGE_KEY);
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
      const list = getAuditHistory();
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
            <div style="font-size: 1rem; font-weight: 600; color: #fff;">No Patient Verifications Recorded Yet</div>
            <div style="font-size: 0.825rem; max-width: 380px;">Whenever you analyze an insurance breakdown, it will automatically save here so you can review previous patient benefits anytime without re-uploading.</div>
          </div>
        `;
        return;
      }

      list.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'history-card-item';
        card.innerHTML = `
          <div class="history-card-left">
            <div class="history-patient-row">
              <span class="patient-hero-badge" style="padding: 0.15rem 0.6rem; font-size: 0.775rem;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                ${escapeHtml(item.patientName)}
              </span>
              <span class="history-patient-title">${escapeHtml(item.carrier)}</span>
            </div>
            <div class="history-meta-info">
              <span>Verified: ${escapeHtml(item.displayDate)}</span>
              <span>•</span>
              <span style="color: ${item.networkStatus.toLowerCase().includes('out') ? '#fda4af' : '#38bdf8'};">${escapeHtml(item.networkStatus)}</span>
              <span>•</span>
              <span>${item.codesCount} CDT codes</span>
            </div>
          </div>
          <div class="history-actions-row">
            <button type="button" class="btn-history-load load-hist-btn" title="View Patient Breakdown">
              Load Audit
            </button>
            <button type="button" class="btn-history-delete del-hist-btn" title="Delete record">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        `;

        // Card clicks
        const loadBtn = card.querySelector('.load-hist-btn');
        loadBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          currentAuditData = item.data;
          renderReportDashboard(currentAuditData);
          historyModal.classList.remove('active');
          displayToast(`Loaded audit for: ${item.patientName}`);
        });

        card.addEventListener('click', () => {
          currentAuditData = item.data;
          renderReportDashboard(currentAuditData);
          historyModal.classList.remove('active');
          displayToast(`Loaded audit for: ${item.patientName}`);
        });

        const delBtn = card.querySelector('.del-hist-btn');
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteHistoryItem(item.id);
        });

        historyListContainer.appendChild(card);
      });
    }

    // History Modal Open / Close Events
    if (openHistoryBtn) {
      openHistoryBtn.addEventListener('click', () => {
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

    // Update history badge counter on initial page load
    updateHistoryCountUI();
