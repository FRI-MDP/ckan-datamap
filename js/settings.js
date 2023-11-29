let settings = {
  fusekiEndpoint: {
    local: "http://localhost:3030/pz",
    remote: "https://triplestore.lavbic.net/pz",
    selected: "remote",
  },
  debug: false,
  "graph-padding": 50,
  "font-size": 16,
  color: {
    class: {
      dark: "#CFA500",
      selected: "black",
    },
    instance: {
      dark: "#993399",
      selected: "black",
    },
    line: {
      normal: "#CCC",
      mouseover: "#808080",
      selected: "black",
    },
  },
  language: "sl",
  nMaxDescriptiveData: 8,
  labelMaxLength: 20,
  hideConcepts: [],
  defaultHideConcepts: [
    { uri: "http://www.w3.org/ns/duv#RatingFeedback", hidden: true },
    { uri: "http://www.w3.org/ns/csvw#uriTemplate", hidden: true },
    { uri: "http://www.w3.org/ns/adms#Identifier", hidden: true },
    { uri: "http://purl.org/dc/terms/Location", hidden: true },
    { uri: "http://www.w3.org/ns/duv#UserFeedback", hidden: true },
    { uri: "http://www.w3.org/ns/duv#UsageTool", hidden: true },
    { uri: "http://www.w3.org/ns/duv#Usage", hidden: true },
    { uri: "http://www.w3.org/ns/csvw#Column", hidden: false },
    { uri: "http://www.w3.org/ns/dqv#Dimension", hidden: true },
    { uri: "http://www.w3.org/ns/prov#Agent", hidden: true },
    { uri: "http://xmlns.com/foaf/0.1/Organization", hidden: true },
    { uri: "http://www.w3.org/ns/csvw#Table", hidden: true },
    {
      uri: "http://onto.mju.gov.si/centralni-besednjak-core#UpravnaEnota",
      hidden: true,
    },
  ],
  highlightConcepts: [
    "http://www.w3.org/ns/dcat#Catalog",
    "http://www.w3.org/ns/dcat#Distribution",
    "http://www.w3.org/ns/dcat#Dataset",
    "http://www.w3.org/ns/csvw#Schema",
  ],
  priorityProperties: [
    "http://purl.org/dc/terms/title",
    "http://purl.org/dc/terms/description",
    //"http://purl.org/dc/terms/identifier",
    //"http://purl.org/dc/terms/language",
    "http://purl.org/dc/terms/publisher",
  ],
  displaySchema: true,
  instanceGraph:
    //"http://onto.mju.gov.si/pz/dataset/erar-evidenca-davcnih-dolznikov-in-nepredlagateljev-davcnih-obracunov",
    "",
  nMaxChildrenForBlankInstanceLabel: 25,
};
settings.hideConcepts = settings.defaultHideConcepts.slice();

const readParams = () => {
  const urlParams = new URLSearchParams(window.location.search);
  let schema = urlParams.get("schema");
  let instanceGraph = urlParams.get("instanceGraph");
  let sparqlEndpoint = urlParams.get("sparqlEndpoint");
  if (sparqlEndpoint != undefined) {
    settings.fusekiEndpoint.remote = sparqlEndpoint;
    settings.fusekiEndpoint.selected = "remote";
  }
  if (schema != undefined) {
    if (schema == "true") settings.displaySchema = true;
    else if (schema == "false") settings.displaySchema = false;
  }
  if (instanceGraph != undefined) settings.instanceGraph = instanceGraph;
};
readParams();

const translations = {
  About: {
    sl: "O programu",
    en: "About",
  },
  AddDefault: {
    sl: "Dodaj privzete",
    en: "Add default",
  },
  Authors: {
    sl: "Avtorji",
    en: "Authors",
  },
  Connection: {
    sl: "Povezava",
    en: "Connection",
  },
  Definition: {
    sl: "Definicija",
    en: "Definition",
  },
  Details: {
    sl: "Podrob-<br>nosti",
    en: "Details",
  },
  DetailsLong: {
    sl: "Podrobnosti",
    en: "Details",
  },
  DescriptiveData: {
    sl: "Opisni podatki",
    en: "Descriptive data",
  },
  DoSearch: {
    sl: "Išči",
    en: "Search",
  },
  ExploreData: {
    sl: "Razišči<br>podatke",
    en: "Explore<br>data",
  },
  ExploreDataLong: {
    sl: "Razišči podatke",
    en: "Explore data",
  },
  Focus: {
    sl: "Fokus",
    en: "Focus",
  },
  From: {
    sl: "Od",
    en: "From",
  },
  Help: {
    sl: "Pomoč",
    en: "Help",
  },
  Hide: {
    sl: "Skrij",
    en: "Hide",
  },
  HiddenConcepts: {
    sl: "Skriti koncepti",
    en: "Hidden concepts",
  },
  Identifier: {
    sl: "Identifikator",
    en: "Identifier",
  },
  Instance: {
    sl: "Primerek konceptov",
    en: "Concepts' instance",
  },
  InstanceGraph: {
    sl: "Graf primerkov",
    en: "Instance graph",
  },
  Language: {
    sl: "Jezik",
    en: "Language",
  },
  Overview: {
    sl: "Pregled",
    en: "Overview",
  },
  OverviewScheme: {
    sl: "Pregled sheme",
    en: "Scheme overview",
  },
  RemoveAll: {
    sl: "Odstrani vse",
    en: "Remove all",
  },
  Settings: {
    sl: "Nastavitve",
    en: "Settings",
  },
  Search: {
    sl: "Iskanje",
    en: "Search",
  },
  To: {
    sl: "Do",
    en: "To",
  },
};

export { settings, translations };
