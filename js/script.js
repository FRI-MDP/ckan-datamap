import { graphData } from "./rdf_helper.js";
import { settings, translations } from "./settings.js";

/**
 * For blank node instances, find the first non-blank referencing node instance
 * @param {string} uri focus class/instance URI
 * @returns
 */
const getBlankNodeLevelUp = (uri) => {
  let result = {
    uri: uri,
    level: 0,
  };
  if (!uri) {
    return undefined;
  } else if (uri.startsWith("_")) {
    let level1Up = data.find((d) => {
      return d.data.objectProperties?.find((op) => op.range == uri);
    })?.data?.id;
    result = undefined;
    if (level1Up) {
      if (!level1Up.startsWith("_")) {
        result = {
          uri: level1Up,
          level: 1,
        };
      } else {
        let level2Up = data.find((d) => {
          return d.data.objectProperties?.find((op) => op.range == level1Up);
        })?.data?.id;
        if (level2Up && !level2Up.startsWith("_")) {
          result = {
            uri: level2Up,
            level: 2,
          };
        }
      }
    }
  }
  return result;
};

/**
 * Load data
 * @param {string} classUri focus class URI
 */
const loadData = async (classUri) => {
  let upLevel = 0;
  if (data && classUri?.startsWith("_")) {
    let levelUp = getBlankNodeLevelUp(classUri);
    if (levelUp) {
      classUri = levelUp.uri;
      upLevel = levelUp.level;
    }
  }

  let params = {
    focusClassUri: classUri,
    graph: !settings.displaySchema ? settings.instanceGraph : undefined,
    schema: !settings.displaySchema ? false : undefined,
  };

  // Load data schema if is not loaded yet)
  dataScheme = !dataScheme ? await graphData() : dataScheme;

  // Load data
  data = Object.values(params).every((x) => x == undefined)
    ? dataScheme
    : await graphData(
        params.focusClassUri,
        params.graph,
        params.schema,
        upLevel
      );

  addSchemaMetadataToInstances();
  filterDataAccordingToSettings();
};

/**
 * Find label of the class in the schema
 * @param {string} uri URI of the class
 * @returns multilingual label of the class
 */
const findClassLabelInSchema = (uri) => {
  let label = dataScheme.find((x) => x.data.id == uri)?.data?.label;
  if (!label) {
    let id = getIdFromURI(uri);
    label = {
      sl: id,
      en: id,
    };
  }
  return label;
};

/**
 * Find definition of the class in the schema
 * @param {string} uri URI of the class
 * @returns multilingual definition of the class
 */
const findClassDefinitionInSchema = (uri) => {
  let definition = dataScheme.find((x) => x.data.id == uri)?.data?.definition;
  return definition;
};

/**
 * Find label of the connection in the schema
 * @param {string} uri URI of the class
 * @returns multilingual label of the class
 */
const findConnectionLabelInSchema = (uri) => {
  let id = uri.split("_")[0];
  let label = dataScheme.find((x) => x.data.id == id)?.data.label;
  if (!label) {
    let labelId = getIdFromURI(id);
    label = {
      sl: labelId,
      en: labelId,
    };
  }
  return label;
};

/**
 * Find label of the property in the schema
 * @param {string} uri URI of the class
 * @returns multilingual label of the property
 */
const findPropertyLabelInSchema = (uri) => {
  // Try to find datatype property
  let label = dataScheme
    .find((x) => x.data.dataProperties?.find((y) => y.id == uri))
    ?.data?.dataProperties.find((x) => x.id == uri).label;
  // If not found, try also object properties
  if (!label)
    label = dataScheme
      .find((x) => x.data.objectProperties?.find((y) => y.id == uri))
      ?.data?.objectProperties.find((x) => x.id == uri).label;
  if (!label) {
    let id = getIdFromURI(uri);
    label = {
      sl: id,
      en: id,
    };
    if (settings.debug) {
      console.log(uri);
      console.log(label);
      console.log("");
    }
  }

  return label;
};

/**
 * Add schema metadata to instances
 */
const addSchemaMetadataToInstances = () => {
  if (!settings.displaySchema) {
    data.map((d) => {
      d.data.classes?.map((c) => {
        c.label = findClassLabelInSchema(c.id);
        let definition = findClassDefinitionInSchema(c.id);
        if (definition) c.definition = definition;
      });
      d.data.dataProperties?.map(
        (dp) => (dp.label = findPropertyLabelInSchema(dp.id))
      );
      d.data.objectProperties?.map(
        (op) => (op.label = findPropertyLabelInSchema(op.id))
      );
      if (d.data.source) d.data.label = findConnectionLabelInSchema(d.data.id);
    });
  }
};

/**
 * Filter out concepts and corresponding edges thar are on exclusion list
 */
const filterDataAccordingToSettings = () => {
  let hiddenConcepts = settings.hideConcepts
    .filter((x) => x.hidden)
    .map((x) => x.uri);
  let hiddenInstances = [];
  data = data.filter((x) => {
    // Classes
    const classItself = hiddenConcepts.includes(x.data.id);
    const sourceClass = hiddenConcepts.includes(x.data.source);
    const targetClass = hiddenConcepts.includes(x.data.target);

    // Instances
    const instanceSuperClasses = x.data.classes?.map((y) => y.id);
    const instaceOfAllSuperClasses = instanceSuperClasses?.every((x) =>
      hiddenConcepts.includes(x)
    );
    if (instaceOfAllSuperClasses) hiddenInstances.push(x.data.id);
    const sourceInstance = hiddenInstances.includes(x.data.source);
    const targetInstance = hiddenInstances.includes(x.data.target);

    // FIXME Če skrijem primerke, je treba shraniti določene informacije (npr. stolpci sheme), ki jih prikazujem tudi, ko teh podrobnosti (tj. stolpcev) ne prikazujem. Podobno je z ostalimi objektnimi lastnostmi

    return !(
      classItself ||
      sourceClass ||
      targetClass ||
      instaceOfAllSuperClasses ||
      sourceInstance ||
      targetInstance
    );
  });
};

/**
 * Trim string with dots
 * @param {string} str string to be trimed
 * @param {number} maxLength max length of a string
 * @returns trimed string
 */
const trimStringWithDots = (str, maxLength) => {
  maxLength = !maxLength ? settings.labelMaxLength : maxLength;
  if (str.length <= maxLength) return str;

  let trimLength = maxLength - 3; // Leave space for the dots
  let startLength = Math.ceil(trimLength / 2);
  let endLength = Math.floor(trimLength / 2);

  let start = str.substring(0, startLength);
  let end = str.substring(str.length - endLength);

  return start + "..." + end;
};

/**
 * Split string into lines
 * @param {string} str string to be split
 * @param {number} maxLength max length of a string
 * @returns splited string
 */
const splitStringIntoLines = (str, maxLength) => {
  maxLength = !maxLength ? settings.labelMaxLength : maxLength;

  let words = str.split(" "),
    lines = [],
    currentLine = "";

  for (const word of words) {
    if (currentLine.length + word.length <= maxLength) {
      currentLine += word + " ";
    } else {
      lines.push(currentLine.trim());
      currentLine = word + " ";
    }
  }

  // Add the remaining line if it's not empty
  if (currentLine.trim() !== "") lines.push(currentLine.trim());

  // If there are more than 2 lines, trim it to 2
  if (lines.length > 2) lines = [lines[0] + " ...", lines[lines.length - 1]];

  return lines;
};

/**
 * Display node label
 * @param {*} el node element
 * @param {boolean} blankAsDataProperty include first data property as label if node is blank
 * @param {boolean} dotsForLengthy if label is too long, trim it with dots
 * @returns
 */
const displayNodeLabel = (
  el,
  blankAsDataProperty = true,
  dotsForLengthy = true
) => {
  // If instance is blank and parent class has only few object properties, display title
  let isBlankNode = el.data("id")?.startsWith("_");
  let isInstance = el.data("type") == "instance";
  if (!blankAsDataProperty && isBlankNode && isInstance) {
    let fromNode = data.find(
      (node) =>
        !!node.data.objectProperties?.find((op) => op.range == el.data("id"))
    );
    if (
      fromNode?.data?.objectProperties?.length <=
      settings.nMaxChildrenForBlankInstanceLabel
    )
      blankAsDataProperty = true;
  }

  let label = splitStringIntoLines(el.data("label")[settings.language])
    .join("\n")
    .trim();
  // If node is blank, display title, name or first data property as label
  if (blankAsDataProperty && label.length == 0) {
    label = "";
    let dataProperties = el.data("dataProperties");
    if (dataProperties) {
      let title = dataProperties.find(
        (dp) => dp.id == "http://www.w3.org/ns/csvw#title"
      )?.value;
      let name = dataProperties.find(
        (dp) => dp.id == "http://www.w3.org/ns/csvw#name"
      )?.value;
      let firstDp = dataProperties[0]["value"];
      label = splitStringIntoLines(title || name || firstDp)
        .join("\n")
        .trim();
    }
  }

  // If oneline label is too long, trim it with dots
  if (dotsForLengthy && label.length > 0 && label.indexOf("\n") == -1)
    label = trimStringWithDots(label);

  return label;
};

/**
 * Draw graph by removing all elements and adding new ones, then apply style and layout
 */
const drawGraph = () => {
  // Remove all elements and add new ones
  if (cy.elements().length) cy.elements().remove();
  cy.add(data);

  // HTML label
  cy.htmlLabel([
    {
      query: "node[type='instance']",
      //halign: "center",
      valign: "bottom",
      //halignBox: "center",
      valignBox: "bottom",
      tpl: (d) => {
        let label = d?.classes
          ?.map((y) => y.label[settings.language] || y.id)
          .join(", ");
        return (
          "<div class='instance-class-details'>" +
          (!label ? "" : label) +
          "</div>"
        );
      },
    },
  ]);

  // Set style
  cy.style().resetToDefault();
  cy.style([
    {
      selector: "node",
      style: {
        "background-color": settings.displaySchema
          ? settings.color.class.dark
          : settings.color.instance.dark,
        color: "#fff",
        "text-outline-width": 2,
        "text-outline-color": settings.displaySchema
          ? settings.color.class.dark
          : settings.color.instance.dark,
        "font-size": settings["font-size"],
        label: (el) => displayNodeLabel(el, false),
        "text-wrap": "wrap",
      },
    },
    {
      selector: "node.semidark",
      style: {
        opacity: 0.5,
      },
    },
    {
      selector: "node:selected",
      style: {
        "background-color": "black",
        "text-outline-color": "black",
        label: (el) => displayNodeLabel(el, true),
      },
    },
    {
      selector: "edge",
      style: {
        width: 2,
        "line-color": settings.color.line.normal,
        "target-arrow-color": settings.color.line.normal,
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        color: "white",
        "text-outline-color": "lightgrey",
        "text-outline-width": 3,
        "font-size": settings["font-size"] * 0.8,
      },
    },
    {
      selector: "edge.semidark",
      style: {
        opacity: 0.5,
      },
    },
    {
      selector: "edge:selected",
      style: {
        "line-color": settings.color.line.selected,
        "text-outline-color": settings.color.line.selected,
        color: "white",
        "target-arrow-color": settings.color.line.selected,
        label: "data(label." + settings.language + ")",
      },
    },
    {
      selector: "node.highlight",
      style: {
        "border-color": "#FFF",
        "border-width": "2px",
        label: (el) => displayNodeLabel(el, true),
      },
    },
    {
      selector: "node.semitransp",
      style: { opacity: "0.2" },
    },
    {
      selector: "edge.highlight",
      style: {
        "mid-target-arrow-color": "#FFF",
        label: "data(label." + settings.language + ")",
        "line-color": settings.color.line.mouseover,
        "text-outline-color": settings.color.line.mouseover,
      },
    },
    {
      selector: "edge.semitransp",
      style: { opacity: "0.1" },
    },
  ]).update();

  // Set layout
  setLayout();

  if (settings.displaySchema) {
    let filter =
      'node[id != "' + settings.highlightConcepts.join('"][id != "') + '"]';
    cy.$(filter).addClass("semidark");
    cy.$(filter).connectedEdges().addClass("semidark");
  } else {
    let filter = function (el) {
      let classes = el.data().classes?.map((c) => c.id);
      if (!classes) return false;
      else return !classes?.some((c) => settings.highlightConcepts.includes(c));
    };
    cy.$(filter).addClass("semidark");
    cy.$(filter).connectedEdges().addClass("semidark");
  }
};

/**
 * Set Cytoscape graph layout
 * @param {string} layout layout name (e.g. "cose-bilkent", "euler")
 */
const setLayout = (layout = "cose-bilkent") => {
  let params = [
    {
      name: "grid",
    },
    {
      name: "circle",
    },
    {
      name: "concentric",
    },
    {
      name: "breadthfirst",
    },
    {
      name: "random",
    },
    {
      name: "cose",
    },
    {
      name: "cose-bilkent",
      fit: true, // fit the viewport to the graph
      padding: settings["graph-padding"],
      animate: false, // animate while running the layout
      nodeDimensionsIncludeLabels: false, // whether labels should be included in determining the space used by a node
      randomize: false, // whether to randomize node positions on the beginning
      componentSpacing: 40, // extra spacing between components in non-compound graphs
      gravity: 1,
      edgeElasticity: 0.2, // e.g. 0.45 causes overlap removal to be more aggressive **** (prej 0.5)
      nodeRepulsion: 50000, // non overlapping node repulsion (higher value => less overlap)
      nodeOverlap: 1000, // overlapping nodes (higher value => less overlap)
      idealEdgeLength: 200, // ideal edge (non nested) length ****
      nestingFactor: 10, // factor to compress/stretch the graph **** (prej 1.2)
      //numIter: 100, // maximum number of iterations to perform ****
      initialTemp: 200, // initial temperature (maximum node displacement)
      coolingFactor: 0.99, // how the temperature is reduced between consecutive iterations
      minTemp: 1.0, // minimum temperature (threshold to stop the algorithm)
    },
  ];
  cy.elements()
    .layout(params.find((p) => p.name === layout))
    .run();
};

/**
 * Show node details
 * @param {object} node Cytoscape node
 */
const showNodeDetails = (node) => {
  hideNodeOrEdgeDetails(node);
  node.popperRefObj = node.popper({
    content: () => {
      let content = document.createElement("div");
      content.classList.add("popper-div");
      let html = "<table>";
      let padding = false;

      // Identifier
      let identifier = showNodeDetailsIdentifier(node);
      html += identifier.html;
      padding = identifier.padding;

      // Instance of
      let instanceOf = showNodeDetailsInstanceOf(node, padding);
      html += instanceOf.html;
      padding = instanceOf.padding;

      // Definition
      let definition = showNodeDetailsDefinition(node, padding);
      html += definition.html;
      padding = definition.padding;

      // List of data and object properties
      let dataAndObjectProperties = showNodeDetailsDataAndObjectProperties(
        node,
        padding
      );
      html += dataAndObjectProperties;

      content.innerHTML = html;
      document.body.appendChild(content);
      $(".toggleDescriptiveData").on("click", () => toggleAllDescriptiveData());
      return content;
    },
  });
};

/**
 * Show edge details
 * @param {*} edge
 */
const showEdgeDetails = (edge) => {
  hideNodeOrEdgeDetails(edge);
  edge.popperRefObj = edge.popper({
    content: () => {
      let content = document.createElement("div");
      content.classList.add("popper-div");
      let html = "<table class='list'>";

      // Identifier
      html +=
        "<tr><th colspan='2'><span data-translate='Identifier'>" +
        translate("Identifier") +
        "</span></th></tr><tr><td colspan='2' class='break-all'>" +
        "<a href='" +
        edge.data().id +
        "' target='_blank'>" +
        formatURI(edge.data().id) +
        "</a></td></tr>";

      let sourceClassLabel, targetClassLabel;
      if (!settings.displaySchema) {
        sourceClassLabel = data
          .find((d) => d.data.id == edge.data().source)
          ?.data.classes.map((c) => c.label[settings.language] || c.id)
          .join(", ");
        targetClassLabel = data
          .find((d) => d.data.id == edge.data().target)
          ?.data.classes.map((c) => c.label[settings.language] || c.id)
          .join(", ");
      }

      // Source class
      let sourceLabel = data.find((d) => d.data.id == edge.data().source)?.data
        .label[settings.language];
      if (!sourceLabel || sourceLabel.length == 0)
        sourceLabel = edge.data().source;
      html +=
        "<tr><th colspan='2' class='odmik'><span data-translate='From'>" +
        translate("From") +
        "</span></th></tr><tr><td>" +
        "<i class='fa-solid fa-circle instance ikona-odmik-desno'></i></td>" +
        "<td><b>" +
        sourceLabel +
        "</b>" +
        (sourceClassLabel ? " (" + sourceClassLabel + ")" : "") +
        "</td></tr>";

      // Property label
      html +=
        "<tr><th colspan='2' class='odmik'><span data-translate='Connection'>" +
        translate("Connection") +
        "</span></th></tr><tr><td>" +
        "<i class='fa-solid fa-square object ikona-odmik-desno'></i></td>" +
        "<td><b>" +
        edge.data().label[settings.language] +
        "</b></td></tr>";

      // Target class
      let targetLabel = data.find((d) => d.data.id == edge.data().target)?.data
        .label[settings.language];
      if (!targetLabel || targetLabel.length == 0)
        targetLabel = edge.data().target;
      html +=
        "<tr><th colspan='2' class='odmik'><span data-translate='To'>" +
        translate("To") +
        "</span></th></tr><tr><td>" +
        "<i class='fa-solid fa-circle instance ikona-odmik-desno'></i></td>" +
        "<td><b>" +
        targetLabel +
        "</b>" +
        (targetClassLabel ? " (" + targetClassLabel + ")" : "") +
        "</td></tr>";

      html += "</table>";

      content.innerHTML = html;
      document.body.appendChild(content);

      return content;
    },
  });
};

/**
 * Show node details with identifier information
 * @param {object} node Cytoscape node
 * @returns { html: string, padding: boolean } HTML table with identifier information and padding
 */
const showNodeDetailsIdentifier = (node) => {
  let padding = false;

  let id = node.data().id;
  let isBlankNode = id.startsWith("_");
  let html = "";

  if (!isBlankNode) {
    html =
      "<tr><th><span data-translate='Identifier'>" +
      translate("Identifier") +
      "</span></th></tr><tr><td class='break-all'>" +
      "<a href='" +
      id +
      "' target='_blank'>" +
      formatURI(id) +
      "</a></td></tr>";
    padding = true;
  }

  return { html, padding };
};

/**
 * Show node details with instance of information
 * @param {object} node Cytoscape node
 * @param {boolean} padding padding for the table rows
 * @returns { html: string, padding: boolean } HTML table with instance of information and padding
 */
const showNodeDetailsInstanceOf = (node, padding) => {
  let html = "";

  if (node.data().type == "instance" && node.data().classes) {
    html +=
      "<tr><th" +
      (padding ? " class='odmik'" : "") +
      "><span data-translate='Instance'>" +
      translate("Instance") +
      "</span></th></tr>";
    html += "<tr><td>";
    html += collectInstanceClasses(node.data().classes);
    html += "</td></tr>";
    padding = true;
  }

  return { html, padding };
};

/**
 * Show node details with definition information
 * @param {object} node Cytoscape node
 * @param {boolean} padding padding for the table rows
 * @returns { html: string, padding: boolean } HTML table with definition information and padding
 */
const showNodeDetailsDefinition = (node, padding) => {
  let html = "";

  if (node.data().definition?.[settings.language]) {
    html +=
      "<tr><th" +
      (padding ? " class='odmik'" : "") +
      "><span data-translate='definition'>" +
      translate("Definition") +
      "</span></th></tr><tr><td>" +
      node.data().definition[settings.language] +
      "</td></tr>";
    padding = true;
  }

  return { html, padding };
};

/**
 * Show node details with data and object properties information
 * @param {object} node Cytoscape node
 * @param {boolean} padding padding for the table rows
 * @returns { string } HTML table with data and object properties information
 */
const showNodeDetailsDataAndObjectProperties = (node, padding) => {
  let html = "";

  if (node.data().dataProperties || node.data().objectProperties) {
    let properties = [];
    if (node.data().dataProperties) {
      properties = [
        ...new Set([
          ...properties,
          ...node.data().dataProperties.map((dp) => {
            dp.type = "data";
            return dp;
          }),
        ]),
      ];
    }
    if (node.data().objectProperties) {
      properties = [
        ...new Set([
          ...properties,
          ...node.data().objectProperties.map((op) => {
            op.type = "object";
            return op;
          }),
        ]),
      ];
    }
    properties = sortProperties(properties);

    html +=
      "<tr><th" +
      (padding ? " class='odmik'" : "") +
      "><span data-translate='DescriptiveData'>" +
      translate("DescriptiveData") +
      "</span></th></tr><tr><td>";
    html += collectNodeDetails(properties);
    html += "</td></tr></table>";
  }

  return html;
};

/**
 * Sort properties in alphabetical order, while considering
 * the language and priority properties
 * @param {array} properties array of data and object properties
 * @returns sorted array of properties
 */
const sortProperties = (properties) => {
  let language = settings.language != "sl" ? "en" : "sl";
  properties = properties.sort((a, b) =>
    a?.label?.sl.localeCompare(b?.label?.[language])
  );

  // Consider priority properties
  settings.priorityProperties.toReversed().forEach((pp) => {
    let i = properties.findIndex((p) => p.id == pp);
    if (i > -1) {
      let p = properties[i];
      properties.splice(i, 1); // remove element
      properties.unshift(p); // add element to the beginning
    }
  });
  return properties;
};

/**
 * Prepare HTML table with properties of a node
 * @param {*} properties data and object properties
 * @returns HTML table with properties
 */
const collectNodeDetails = (properties) => {
  let html =
    "<table class='list'>" +
    properties
      .map((p, i) => {
        let isInstance = p.value != undefined;
        let isBlankNode = (isInstance ? p.value : p.range).startsWith("_g");
        return (
          "<tr " +
          (i >= settings.nMaxDescriptiveData ? "class='list-toggle'" : "") +
          "><td><i class='fa-solid fa-square " +
          (p.type == "data" ? "datatype" : "object") +
          " ikona-odmik-desno'></i></td>" +
          "<td><b>" +
          p.label[settings.language] +
          "</b><span" +
          (isBlankNode ? " style='display:none'" : "") +
          "> &rarr; <small>" +
          (isInstance
            ? p.value
            : (p.rangeLabel?.[settings.language]
                ? p.rangeLabel[settings.language] + " &rarr; "
                : "") +
              "<a href='" +
              p.range +
              "' target='_blank' style='white-space:nowrap'>" +
              formatURI(p.range, true) +
              " <i class='fa-solid fa-up-right-from-square small'></i>" +
              "</a>") +
          "</small></span>" +
          collectColumnDetails(p)
        );
      })
      .join("</td></tr>") +
    (properties.length > settings.nMaxDescriptiveData
      ? "<tr class='button-toggle'><td></td><td>" +
        "<i class='fa-solid fa-ellipsis hover toggleDescriptiveData' style='padding-right:5px'></i>" +
        "</td></tr>"
      : "") +
    "</table>";
  return html;
};

/**
 * Prepare HTML row with additional property details
 * @param {object} property data or object property
 * @returns html for property details
 */
const collectColumnDetails = (property) => {
  let html = "";

  if (property.id == "http://www.w3.org/ns/csvw#column") {
    let propertyDetails = data.find((d) => d.data.id == property.range)?.data;
    let range = propertyDetails?.objectProperties?.find(
      (op) => op.id == "http://www.w3.org/ns/csvw#datatype"
    )?.range;
    let name = propertyDetails?.dataProperties?.find(
      (dp) => dp.id == "http://www.w3.org/ns/csvw#name"
    )?.value;
    let title = propertyDetails?.dataProperties?.find(
      (dp) => dp.id == "http://www.w3.org/ns/csvw#title"
    )?.value;

    html +=
      "<span>" +
      (range
        ? " &rarr; " +
          "<small><a href='" +
          range +
          "' target='_blank' style='white-space:nowrap'>" +
          formatURI(range, true) +
          " <i class='fa-solid fa-up-right-from-square small'></i></a>" +
          "</small>"
        : "") +
      (name ? " &rarr; <b><small>" + name + "</small></b>" : "") +
      (title ? " &rarr; <small>" + title + "</small>" : "");
  }

  return html;
};

/**
 * Prepare HTML table with properties of a node
 * @param {*} properties data and object properties
 * @returns HTML table with properties
 */
const collectInstanceClasses = (classes) => {
  let html =
    "<table class='list'>" +
    classes
      .map((c) => {
        return (
          "<tr><td><i class='fa-solid fa-square instance ikona-odmik-desno'></i></td>" +
          "<td><b>" +
          c.label[settings.language] +
          "</b>" +
          (c.definition?.[settings.language]
            ? "<br><small>" + c.definition[settings.language] + "</small>"
            : "")
        );
      })
      .join("</td></tr>") +
    "</table>";
  return html;
};

/**
 * Toggle visibility of all descriptive data
 */
const toggleAllDescriptiveData = () => {
  $(".list-toggle").css("visibility") == "collapse"
    ? $(".list-toggle").css("visibility", "visible")
    : $(".list-toggle").css("visibility", "collapse");
  $(".button-toggle").css("visibility") == "collapse"
    ? $(".button-toggle").css("visibility", "visible")
    : $(".button-toggle").css("visibility", "collapse");
};

/**
 * Hide node details
 * @param {*} node Cytoscape node
 */
const hideNodeOrEdgeDetails = (node) => {
  if (node.popperRefObj) {
    node.popperRefObj.state.elements.popper.remove();
    node.popperRefObj.destroy();
  }
};

/**
 * Get last part of URI as ID (e.g. after last "/" or "#")
 * @param {string} uri URI
 * @returns ID from URI
 */
const getIdFromURI = (uri) => {
  let match = RegExp(/([/#])[^/#]*$/).exec(uri);
  uri = !match ? uri : uri.substring(match.index + 1, uri.length);
  return uri;
};

/**
 * Format URI
 * @param {string} uri URI of a resource
 * @param {boolean} hidePrefix show only the last part of the URI
 * @returns formatted URI
 */
const formatURI = (uri, hidePrefix = false) => {
  let regex = /([/#])[^/#]*$/;
  let match = RegExp(regex).exec(uri);
  let result = "";
  if (match) {
    if (!hidePrefix) {
      result =
        uri.substring(0, match.index + 1) +
        "<b style='white-space:nowrap'>" +
        uri.substring(match.index + 1, uri.length) +
        " <i class='fa-solid fa-up-right-from-square'></i></b>";
    } else {
      result = uri.substring(match.index + 1, uri.length);
    }
  }
  if (result.length == 0) result = uri;
  return result;
};

/**
 * Toggle content of modal window
 */
const toggleModalWindow = (elements) => {
  if (!elements)
    elements = {
      hideAll: false,
      settings: true,
      search: true,
      show_hide: true,
      instance_graph: true,
      help: false,
    };
  if (elements.hideAll) {
    Object.keys(elements).forEach((element) => {
      $(element).css("display", "none");
    });
  }
  Object.keys(elements)
    .filter((element) => element != "hideAll")
    .forEach((element) => {
      if (elements[element]) {
        $(`#${element}`).css("display") == "none"
          ? $(`#${element}`).css("display", "block")
          : $(`#${element}`).css("display", "none");
      }
    });
  if ($("#help").is(":visible") && !elements.help) {
    $("#help").css("display", "none");
  } else if ($("#settings").is(":visible") && !elements.settings) {
    ["settings", "search", "show_hide", "instance_graph"].forEach((element) =>
      $("#" + element).css("display", "none")
    );
  }
  if (elements.instance_graph && settings.displaySchema)
    $("#instance_graph").css("display", "none");
  else if (
    !elements.instance_graph &&
    !settings.displaySchema &&
    !elements.hideAll &&
    elements.settings
  )
    $("#instance_graph").css("display", "block");
};

/**
 * Translate text
 * @param {string} key key of the translation
 * @returns translated text
 */
const translate = (key) => {
  return translations[key] ? translations[key][settings.language] : key;
};

/**
 * Find all elements with data-translate attribute and translate them
 */
const translateAll = () => {
  document.querySelectorAll("[data-translate]").forEach((element) => {
    let translation = translate(element.getAttribute("data-translate"));
    if (element.getAttribute("data-bs-toggle") == "tooltip") {
      element.setAttribute("title", translation);
      element.setAttribute("aria-label", translation);
      element.setAttribute("data-bs-original-title", translation);
    } else element.innerHTML = translation;
  });
};

/**
 * Set values of GUI elements to default values
 */
const setGuiDefaultValues = () => {
  $("select[name='jezik']").val(settings.language);
  $(".toggleHiddenConcept").off("click");
  $("#hiddenConceptsList").empty();
  settings.hideConcepts.forEach((hc) => {
    $("#hiddenConceptsList").append(
      "<div class='col-12'>" +
        "<i class='fa-solid fa-eye" +
        (hc.hidden ? "-slash" : "") +
        " pe-1 povezava hover toggleHiddenConcept'></i>" +
        "<i class='fa-solid fa-trash-can pe-1 povezava hover removeHiddenConcept'></i>" +
        hc.uri +
        "</div>"
    );
  });
  $(".toggleHiddenConcept").on("click", function () {
    let url = $(this).parent().text();
    let hidden = !$(this).attr("class").split(" ").includes("fa-eye-slash");
    manipulateConceptToHideList(url, false, hidden);
  });
  $(".removeHiddenConcept").on("click", function () {
    let url = $(this).parent().text();
    manipulateConceptToHideList(url, false, undefined, true);
    if (settings.hideConcepts.length == 0) {
      $("#doRemoveAll span").attr(
        "data-translate",
        settings.hideConcepts.length == 0 ? "AddDefault" : "RemoveAll"
      );
      translateAll();
    }
  });
};

/**
 * Reload graph with loading data, drawing graph and setting event handlers
 */
const reloadGraph = async () => {
  await loadData();
  drawGraph();
  setRightMouseClickHandler();
  toggleModalWindow({
    hideAll: true,
  });
};

/**
 * Set event handlers for right click on background and nodes
 */
const setRightMouseClickHandler = () => {
  /**
   * Node mouse right click
   */
  if (rightClickMenuBackground) rightClickMenuBackground.destroy();
  rightClickMenuBackground = cy.cxtmenu({
    selector: "node",
    indicatorSize: 14,
    atMouse: false,
    commands: [
      {
        content:
          '<i class="fa-solid fa-magnifying-glass-plus"></i>' +
          '<div style="margin-top:6px">' +
          '<small class="smaller">' +
          translate("Focus") +
          "</small></div>",
        select: async (el) => {
          await loadData(el.data("id"));
          drawGraph();
        },
        enabled: /*settings.displaySchema*/ true,
      },
      {
        content:
          '<i class="fa-solid fa-magnifying-glass-chart"></i>' +
          '<div style="margin-top:6px">' +
          '<small class="smaller">' +
          translate("ExploreData") +
          "</small></div>",
        select: (el) => {
          // FIXME Razišči podatke iz izbranega elementa el.data("id")
        },
        enabled: false,
      },
      {
        content:
          '<i class="fa-solid fa-circle-info"></i>' +
          '<div style="margin-top:6px">' +
          '<small class="smaller">' +
          translate("Details") +
          "</small></div>",
        select: (el) => {
          el.select();
          showNodeDetails(el);
        },
      },
      {
        content:
          '<i class="fa-solid fa-filter-circle-xmark"></i>' +
          '<div style="margin-top:6px">' +
          '<small class="smaller">' +
          translate("Hide") +
          "</small></div>",
        select: (el) => {
          let id =
            el.data("type") == "instance"
              ? el.data("classes")?.[0]?.id
              : el.data("id");
          manipulateConceptToHideList(id, false);
        },
      },
      {
        content:
          '<i class="fa-solid fa-magnifying-glass-minus"></i>' +
          '<div style="margin-top:6px">' +
          '<small class="smaller">' +
          translate("Overview") +
          "</small></div>",
        select: async () => {
          await loadData();
          drawGraph();
        },
        enabled: /*settings.displaySchema*/ true,
      },
    ],
  });

  /**
   * Background mouse right click
   */
  if (rightClickMenuNodes) rightClickMenuNodes.destroy();
  rightClickMenuNodes = cy.cxtmenu({
    selector: "core",
    commands: [
      {
        content:
          '<i class="fa-solid fa-magnifying-glass-chart"></i>' +
          '<div style="margin-top:6px">' +
          '<small class="smaller">' +
          translate("ExploreData") +
          "</small></div>",
        select: async () => {
          settings.displaySchema = false;
          await reloadGraph();
        },
        enabled: settings.displaySchema,
      },
      {
        content:
          '<i class="fa-solid fa-magnifying-glass-minus"></i>' +
          '<div style="margin-top:6px">' +
          '<small class="smaller">' +
          translate("OverviewScheme") +
          "</small></div>",
        select: async () => {
          settings.displaySchema = true;
          await reloadGraph();
        },
        enabled: !settings.displaySchema,
      },
    ],
  });
};

/**
 * Manipulate (add new concept or clear) a list of hidden concepts
 * @param {string} uri concept uri
 * @param {boolean} clear clear list of all hidden concepts
 * @param {boolean} hidden hide or show concept
 * @param {boolean} removeOnly remove concept from the list
 */
const manipulateConceptToHideList = async (
  uri,
  clear = false,
  hidden = true,
  removeOnly = false
) => {
  let doReload = clear;
  if (uri) {
    if (settings.hideConcepts.some((hc) => hc.uri == uri)) {
      settings.hideConcepts = settings.hideConcepts.map((hc) => {
        if (hc.uri == uri) {
          hc.hidden = hidden;
          if (!hidden) doReload = true;
        }
        return hc;
      });
    } else settings.hideConcepts.push({ uri, hidden });
  }
  if (clear) settings.hideConcepts = [];
  else if (!clear && removeOnly)
    settings.hideConcepts = settings.hideConcepts.filter((hc) => hc.uri != uri);
  if (doReload) await loadData();
  setGuiDefaultValues();
  filterDataAccordingToSettings();
  drawGraph();
};

/**
 * Iskanje po elementih, prikazanih na trenutnem zaslonu.
 * Rezultat iskanja so vsi elementi, ki vsebujejo iskani niz v svojem
 * id-ju, oznaki, definiciji ali podatkih, povezanih s podatkovnimi oz.
 * objektnimi lastnostmi. Rezultat iskanja se prikaže na zaslonu kot
 * označen gradnik (npr. točka oz. povezava v grafu).
 */
const searchCurrentView = () => {
  // Unselect all nodes and edges
  cy.elements().unselect();

  // Get search keyword
  let kw = $("input[name='search']").val();
  if (kw.length < 2) return;

  // Find all nodes and edges that match the search criteria
  let filteredIds = data
    .filter((element) => {
      let regex = new RegExp(kw, "i");
      let foundInId = element.data.id.match(regex);
      let foundInDefinition =
        element.data.definition?.en?.match(regex) ||
        element.data.definition?.sl?.match(regex);
      let foundInLabel =
        element.data.label?.en?.match(regex) ||
        element.data.label?.sl?.match(regex);

      let foundInDataPropertiesIds = element.data?.dataProperties
        ?.map((dp) => dp.id)
        .some((id) => id.match(regex));
      let foundInDataPropertiesLabelsSl = element.data?.dataProperties
        ?.map((dp) => dp.label?.sl)
        .some((label_sl) => label_sl.match(regex));
      let foundInDataPropertiesLabelsEn = element.data?.dataProperties
        ?.map((dp) => dp.label?.en)
        .some((label_en) => label_en.match(regex));
      let foundInObjectPropertiesIds = element.data?.objectProperties
        ?.map((dp) => dp.id)
        .some((id) => id.match(regex));
      let foundInObjectPropertiesLabelsSl = element.data?.objectProperties
        ?.map((dp) => dp.label?.sl)
        .some((label_sl) => label_sl.match(regex));
      let foundInObjectPropertiesLabelsEn = element.data?.objectProperties
        ?.map((dp) => dp.label?.en)
        .some((label_en) => label_en.match(regex));
      let foundInDataPropertiesValues = element.data?.dataProperties
        ?.map((dp) => (dp.value ? dp.value : ""))
        .some((value) => value.match(regex));

      return (
        foundInId ||
        foundInDefinition ||
        foundInLabel ||
        foundInDataPropertiesIds ||
        foundInDataPropertiesLabelsSl ||
        foundInDataPropertiesLabelsEn ||
        foundInObjectPropertiesIds ||
        foundInObjectPropertiesLabelsSl ||
        foundInObjectPropertiesLabelsEn ||
        foundInDataPropertiesValues
      );
    })
    .map((x) => x.data.id);

  // Select all nodes and edges that match the search criteria
  cy.filter((element) => {
    return filteredIds.includes(element.data("id"));
  }).select();
};

let cy, data, dataScheme, rightClickMenuBackground, rightClickMenuNodes;
(async () => {
  setGuiDefaultValues();
  translateAll();

  cy = cytoscape({
    container: document.getElementById("cy"),
  });
  await reloadGraph();

  cy.on("click", "node", (e) => showNodeDetails(e.target));

  cy.on("click", "edge", (e) => showEdgeDetails(e.target));

  cy.on("mouseover", "node", (e) => {
    // Change cursor
    if (e.cy.container()) e.cy.container().style.cursor = "pointer";

    // Focus on the neighbouring nodes
    cy.elements()
      .difference(e.target.outgoers().union(e.target.incomers()))
      .not(e.target)
      .addClass("semitransp");
    e.target
      .addClass("highlight")
      .outgoers()
      .union(e.target.incomers())
      .addClass("highlight");

    // Show node details if selected
    if (e.target.selected()) showNodeDetails(e.target);
  });

  cy.on("mouseout", "node", function (e) {
    // Reset cursor
    if (e.cy.container()) e.cy.container().style.cursor = "default";

    // Unfocus on the neighbouring nodes
    cy.elements().removeClass("semitransp");
    e.target
      .removeClass("highlight")
      .outgoers()
      .union(e.target.incomers())
      .removeClass("highlight");

    // Hide node details if selected and exists
    if (e.target.popper && e.target.selected()) hideNodeOrEdgeDetails(e.target);
  });

  cy.on("mouseover", "edge", (e) => {
    // Change cursor
    if (e.cy.container()) e.cy.container().style.cursor = "pointer";

    // Focus on the neighbouring nodes
    cy.elements()
      .difference(e.target.sources().union(e.target.targets()))
      .not(e.target)
      .addClass("semitransp");
    e.target
      .addClass("highlight")
      .outgoers()
      .union(e.target.incomers())
      .addClass("highlight");

    // Show edge details if selected
    if (e.target.selected()) showEdgeDetails(e.target);
  });

  cy.on("mouseout", "edge", (e) => {
    // Reset cursor
    if (e.cy.container()) e.cy.container().style.cursor = "default";

    // Unfocus on the neighbouring nodes
    cy.elements().removeClass("semitransp");
    e.target
      .removeClass("highlight")
      .outgoers()
      .union(e.target.incomers())
      .removeClass("highlight");

    // Hide edge details if selected and exists
    if (e.target.popper && e.target.selected()) hideNodeOrEdgeDetails(e.target);
  });

  window.addEventListener("resize", () => {
    let container = document.getElementById("cy");
    cy.resize({
      width: container.clientWidth,
      height: container.clientHeight,
    });
    cy.fit(settings["graph-padding"]);
  });

  $("#modalShowHide").on("click", () =>
    toggleModalWindow({
      hideAll: true,
      settings: true,
      search: true,
      show_hide: true,
      instance_graph: true,
      help: false,
    })
  );
  $("#helpShowHide").on("click", () =>
    toggleModalWindow({
      hideAll: false,
      settings: false,
      search: false,
      show_hide: false,
      instance_graph: false,
      help: true,
    })
  );

  $("#doSearch").on("click", () => searchCurrentView());
  $("#doRemoveAll").on("click", () => {
    let clear = settings.hideConcepts.length != 0;
    if (settings.hideConcepts.length == 0)
      settings.hideConcepts = settings.defaultHideConcepts.slice();
    manipulateConceptToHideList(undefined, clear, false, false);
    $("#doRemoveAll span").attr(
      "data-translate",
      settings.hideConcepts.length == 0 ? "AddDefault" : "RemoveAll"
    );
    translateAll();
  });

  $('select[name="jezik"]').on("change", function () {
    settings.language = this.value;
    translateAll();
    drawGraph();
    setRightMouseClickHandler();
  });

  $('select[name="grafi_instanc"]').on("change", function () {
    settings.instanceGraph = this.value;
    if (!settings.displaySchema) reloadGraph();
  });

  $('input[name="search"]').on("keyup", (e) => {
    if (e.key === "Enter" || e.keyCode === 13) searchCurrentView();
  });

  // Bootstrap tooltips
  [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]')).map(
    (tooltipTriggerEl) =>
      new bootstrap.Tooltip(tooltipTriggerEl, {
        delay: { show: 1000, hide: 0 },
        template:
          '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner small"></div></div>',
      })
  );
})();
