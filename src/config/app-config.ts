import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "ATCIS",
  version: "6.2",
  copyright: `© ${currentYear}, ATCIS.`,
  meta: {
    title: "ATCIS - Automated Tender Capture & Intelligence System",
    description:
      "ATCIS is an enterprise automated tender capture and procurement intelligence system across PRAZ (Zimbabwe), ZPPA (Zambia), World Bank, and UN procurement agencies.",
  },
};
