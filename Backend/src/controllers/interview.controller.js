const pdfParse = require("pdf-parse")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")




/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res) {
    try {
        console.log("========== REQUEST ==========");
        console.log("Content-Type:", req.headers["content-type"]);
        console.log("file:", req.file ? { originalname: req.file.originalname, size: req.file.size } : "no file");
        console.log("body:", { jobDescriptionLength: req.body?.jobDescription?.length, selfDescriptionLength: req.body?.selfDescription?.length });

        const { selfDescription, jobDescription } = req.body;

        if (!jobDescription || !jobDescription.trim()) {
            return res.status(400).json({
                message: "Target job description is required."
            });
        }

        let resumeText = "";
        if (req.file && req.file.buffer) {
            try {
                console.log("Parsing PDF buffer of size:", req.file.buffer.length);
                const parsed = await (new pdfParse.PDFParse(Uint8Array.from(req.file.buffer))).getText();
                resumeText = parsed.text || "";
                console.log("Resume parsed successfully! Extracted characters:", resumeText.length);
            } catch (pdfErr) {
                console.warn("PDF parse failed, falling back to text decoding:", pdfErr.message);
                resumeText = req.file.buffer.toString("utf-8");
            }
        } else if (req.body.resume && typeof req.body.resume === "string") {
            resumeText = req.body.resume;
        }

        if (!resumeText.trim() && (!selfDescription || !selfDescription.trim())) {
            return res.status(400).json({
                message: "Please upload a valid resume or enter a self-description."
            });
        }

        const interViewReportByAi = await generateInterviewReport({
            resume: resumeText,
            selfDescription: selfDescription || "",
            jobDescription
        });

        console.log("AI Strategy Generated Successfully for:", interViewReportByAi.title);

        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeText,
            selfDescription: selfDescription || "",
            jobDescription,
            title: interViewReportByAi.title || "Software Engineer",
            ...interViewReportByAi
        });

        return res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport
        });

    } catch (err) {
        console.error("========= ERROR IN GENERATE REPORT =========");
        console.error(err);

        return res.status(500).json({
            message: err.message || "Failed to generate interview report."
        });
    }
}

/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {

    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport
    })
}


/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        message: "Interview reports fetched successfully.",
        interviewReports
    })
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    const { interviewReportId } = req.params

    const interviewReport = await interviewReportModel.findById(interviewReportId)

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const { resume, jobDescription, selfDescription } = interviewReport

    const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
    })

    res.send(pdfBuffer)
}


/**
 * @description Controller to delete interview report
 */
async function deleteInterviewReportController(req, res) {
    try {
        const { id } = req.params;

        const report = await interviewReportModel.findById(id);

        if (!report) {
            return res.status(404).json({
                message: "Report not found."
            });
        }

        // Ensure user owns the report
        if (report.user.toString() !== req.user.id) {
            return res.status(403).json({
                message: "Unauthorized."
            });
        }

        await report.deleteOne();

        res.status(200).json({
            message: "Report deleted successfully."
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: "Error deleting report."
        });
    }
}

module.exports = { generateInterViewReportController, getInterviewReportByIdController, getAllInterviewReportsController, generateResumePdfController, deleteInterviewReportController}